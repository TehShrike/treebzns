import type { PoolConnection } from 'mysql2/promise'
import type { ArbostarImage } from '#arbostar_export/images.d.ts'
import type { S3Client } from '#shared/s3/s3_client.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { TransactionConnection } from '#shared/mysql/helpers.ts'
import { upload_project_image_files_to_storage, type ProjectImageFileBody } from '#shared/project_image/upload_project_image_files_to_storage.ts'
import { fns } from '#shared/sql_request/mysql_function.ts'
import { filter, filter_map, flat_map, for_each, map, map_with_concurrency } from '#shared/array.ts'
import { ROWS_PER_BATCH } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import type { ExistingProjectImage } from './load_existing_correlations.ts'

export const UPLOAD_CONCURRENCY = 8

export type ImageFiles = {
	original: ProjectImageFileBody
	thumbnail: ProjectImageFileBody
}

export type ReadArbostarImageFileFromDisk = (image: { local_path: string; image_id: number }) => Promise<ImageFiles>

export type RunTransaction = <Result>(
	fn: (connection: TransactionConnection<PoolConnection>, write_helper: TenantedWriteHelper) => Promise<Result>,
) => Promise<Result>

export type ImportedImages = {
	counts: {
		project_images_inserted: number
		project_images_updated: number
		project_images_deleted: number
		project_images_uploaded: number
		project_images_upload_failed: number
		skipped_images_without_line_item: number
	}
}

type ImageRow = {
	image: ArbostarImage
	project_id: bigint
	project_line_item_id: bigint
	upload_employee_id: bigint | null
	sort: bigint
}

// images.js → project_image + project_line_item_image, update-or-insert by arbostar_image_id.
// The object key carries the project_image_id, so the rows exist first (uploaded_at null), the
// files upload outside any transaction, and a second transaction stores the keys. A photo whose
// upload failed keeps its null uploaded_at and is retried on the next run. The display variant
// is left empty, like an in-app photo with no markup.
export const import_images = async ({
	run_transaction,
	context,
	images,
	s3,
	read_arbostar_image_file_from_disk,
	lead_ids_to_download_images_for,
	log,
	project_id_by_arbostar_lead_id,
	project_line_item_id_by_arbostar_line_item_id,
	employee_id_by_arbostar_user_id,
}: {
	run_transaction: RunTransaction
	context: ArbostarImportContext
	images: ArbostarImage[]
	s3: S3Client
	// A JPEG original plus its thumbnail (see scripts/arbostar/image_files.ts).
	read_arbostar_image_file_from_disk: ReadArbostarImageFileFromDisk
	// The leads the image export covered. Photos are only deleted within these leads: a lead
	// outside that set has no photos in images.js whether or not it has any in ArboStar.
	lead_ids_to_download_images_for: Set<number>
	log: (message: string) => void
	project_id_by_arbostar_lead_id: Map<number, bigint>
	project_line_item_id_by_arbostar_line_item_id: Map<number, bigint>
	employee_id_by_arbostar_user_id: Map<number, bigint>
}): Promise<ImportedImages> => {
	const existing = context.existing.project_image_by_arbostar_image_id

	const position_within_line_item = new Map<number, bigint>()
	const rows = filter_map(images, (image): ImageRow | null => {
		const project_id = project_id_by_arbostar_lead_id.get(image.lead_id)
		const project_line_item_id = project_line_item_id_by_arbostar_line_item_id.get(image.line_item_id)
		if (project_id === undefined || project_line_item_id === undefined) return null
		const sort = position_within_line_item.get(image.line_item_id) ?? 0n
		position_within_line_item.set(image.line_item_id, sort + 1n)
		return {
			image,
			project_id,
			project_line_item_id,
			upload_employee_id: image.uploaded_by_user_id === null ? null : employee_id_by_arbostar_user_id.get(image.uploaded_by_user_id) ?? null,
			sort,
		}
	})
	const existing_rows = filter(rows, row => existing.has(row.image.image_id))
	const new_rows = filter(rows, row => !existing.has(row.image.image_id))

	const incoming_image_ids = new Set(map(rows, row => row.image.image_id))
	const in_scope_project_ids = new Set(filter_map(
		[...project_id_by_arbostar_lead_id.entries()],
		([lead_id, project_id]) => lead_ids_to_download_images_for.has(lead_id) ? project_id : null,
	))
	const stale = filter(
		[...existing.entries()],
		([arbostar_image_id, row]) => !incoming_image_ids.has(arbostar_image_id) && in_scope_project_ids.has(row.project_id),
	)

	const { project_image_id_by_arbostar_image_id } = await run_transaction(async (connection, write_helper) => {
		const project_image_id_by_arbostar_image_id = new Map<number, bigint>(
			map(existing_rows, row => [row.image.image_id, existing.get(row.image.image_id)!.project_image_id] as const),
		)

		await write_helper.bulk_update(
			'project_image',
			'project_image_id',
			map(existing_rows, row => ({
				value: existing.get(row.image.image_id)!.project_image_id,
				set: {
					project_id: row.project_id,
					visible_to_client: row.image.in_estimate_pdf,
					upload_employee_id: row.upload_employee_id,
				},
			})),
			ROWS_PER_BATCH,
		)
		await write_helper.bulk_update(
			'project_line_item_image',
			'project_line_item_image_id',
			map(existing_rows, row => ({
				value: existing.get(row.image.image_id)!.project_line_item_image_id,
				set: { project_line_item_id: row.project_line_item_id, sort: row.sort },
			})),
			ROWS_PER_BATCH,
		)

		if (new_rows.length > 0) {
			const { insert_ids } = await write_helper.bulk_insert(
				'project_image',
				map(new_rows, row => ({
					project_id: row.project_id,
					original_object_key: '',
					display_object_key: '',
					thumbnail_object_key: '',
					description: '',
					visible_to_client: row.image.in_estimate_pdf,
					uploaded_at: null,
					arbostar_image_id: BigInt(row.image.image_id),
					upload_employee_id: row.upload_employee_id,
				})),
				ROWS_PER_BATCH,
			)
			for_each(new_rows, (row, index) => project_image_id_by_arbostar_image_id.set(row.image.image_id, insert_ids[index]!))
			await write_helper.bulk_insert(
				'project_line_item_image',
				map(new_rows, (row, index) => ({
					project_image_id: insert_ids[index]!,
					project_line_item_id: row.project_line_item_id,
					sort: row.sort,
				})),
				ROWS_PER_BATCH,
			)
		}

		if (stale.length > 0) {
			const stale_project_image_ids = map(stale, ([, row]) => row.project_image_id)
			await write_helper.delete('project_line_item_image', 'project_image_id', stale_project_image_ids, ROWS_PER_BATCH)
			await write_helper.delete('project_image', 'project_image_id', stale_project_image_ids, ROWS_PER_BATCH)
		}

		return { project_image_id_by_arbostar_image_id }
	})

	await delete_objects(s3, flat_map(stale, ([, row]) => object_keys_of(row)))

	const pending = filter(rows, row => {
		const existing_row = existing.get(row.image.image_id)
		return existing_row === undefined || existing_row.uploaded_at === null
	})
	let failed = 0
	const uploaded = filter_map(
		await map_with_concurrency(
			pending,
			UPLOAD_CONCURRENCY,
			async row => {
				const project_image_id = project_image_id_by_arbostar_image_id.get(row.image.image_id)!
				try {
					const files = await read_arbostar_image_file_from_disk({ local_path: row.image.local_path, image_id: row.image.image_id })
					const { original_object_key, thumbnail_object_key } = await upload_project_image_files_to_storage({
						s3,
						company_id: context.company_id,
						project_image_id,
						files: { ...files, display: null },
					})
					return { project_image_id, original_object_key, thumbnail_object_key }
				} catch (error) {
					failed += 1
					log(`Upload of ArboStar image ${row.image.image_id} (${row.image.local_path}) failed: ${error instanceof Error ? error.message : String(error)}`)
					return null
				}
			},
			(done, total) => {
				if (done % 100 === 0 || done === total) log(`  ${done} / ${total} photos uploaded`)
			},
		),
		result => result,
	)

	if (uploaded.length > 0) {
		await run_transaction(async (_connection, write_helper) => {
			await write_helper.bulk_update(
				'project_image',
				'project_image_id',
				map(uploaded, ({ project_image_id, original_object_key, thumbnail_object_key }) => ({
					value: project_image_id,
					set: { original_object_key, thumbnail_object_key, uploaded_at: fns.utc_timestamp() },
				})),
				ROWS_PER_BATCH,
			)
		})
	}

	return {
		counts: {
			project_images_inserted: new_rows.length,
			project_images_updated: existing_rows.length,
			project_images_deleted: stale.length,
			project_images_uploaded: uploaded.length,
			project_images_upload_failed: failed,
			skipped_images_without_line_item: images.length - rows.length,
		},
	}
}

const object_keys_of = (row: ExistingProjectImage): string[] =>
	filter([row.original_object_key, row.display_object_key, row.thumbnail_object_key], key => key !== '')

// Runs after the transaction that removed the rows has committed, so a crash leaves at worst
// an orphan object, never a row pointing at a missing object.
export const delete_objects = async (s3: S3Client, keys: string[]): Promise<void> => {
	await map_with_concurrency(keys, UPLOAD_CONCURRENCY, key => s3.delete_object({ key }))
}
