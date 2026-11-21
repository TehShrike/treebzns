import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import fnum, { type FinancialNumber } from '#shared/fnum.ts'
import { map, filter, filter_map, flat_map, for_each, some } from '#shared/array.ts'
import { ROWS_PER_BATCH, group_by, join_lines, money, normalize_name } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import arbostar_number_to_fnum from './arbostar_number_to_fnum.ts'
import default_values from '#shared/treebzns_db/default_values.ts'

export type ImportedLineItems = {
	project_line_item_id_by_arbostar_line_item_id: Map<number, bigint>
	// Object keys of the imported photos that went with the deleted lines. The rows are gone
	// once the transaction commits; the caller removes the objects afterwards.
	deleted_object_keys: string[]
	counts: {
		work_types_inserted: number
		project_line_items_inserted: number
		project_line_items_updated: number
		project_line_items_deleted: number
		project_images_deleted_with_line_items: number
		project_line_item_work_items_inserted: number
		project_line_item_work_items_updated: number
		project_line_item_work_items_deleted: number
		project_line_items_split_in_app: number
		project_line_items_kept_no_longer_in_export: number
		skipped_line_items_without_project: number
		duplicate_line_items_dropped: number
	}
}

// ArboStar's estimate editor payload reuses a handful of line ids: the June 2026 export has 13
// ids appearing twice — one real row and one phantom (null service/price/quantity) on an
// unrelated newer lead. Keep whichever copy carries the most data.
const data_score = (item: ArbostarLineItem): number =>
	(item.service_name === null ? 0 : 1) + (item.price === null ? 0 : 1) + (item.quantity === null ? 0 : 1)

const new_work_type_hourly_rate = fnum('100.00')
const quantity_when_arbostar_has_none = fnum('1.00')

export const line_item_price = (item: Pick<ArbostarLineItem, 'price' | 'quantity'>): FinancialNumber =>
	(item.price === null ? default_values.project_line_item.price : money(item.price))
		.times(item.quantity === null ? quantity_when_arbostar_has_none : money(item.quantity))
		.changeDecimalPlaces(2)

// A Declined line is imported as client_optional even when ArboStar didn't flag it optional:
// this schema only allows declining optional lines, and a declined line's fate (never billed —
// verified against invoice totals) matters more than how it was originally offered.
// line_items.js → work_type + project_line_item + project_line_item_work_item, update-or-insert.
// Work types are naturally keyed by name per company — existing ones are reused (their taxable
// flag and hourly rate are left as set), only unseen names are inserted. Line items correlate by
// arbostar_line_item_id, and ones that disappeared from the export are deleted — stale lines
// would inflate project totals, which derive from line items — but only within projects present
// in this run, so a lead missing from a (possibly partial) export keeps its lines just like it
// keeps its project. In-app lines (null arbostar id) are never touched.
// Each ArboStar line owns one work item. The work item has no ArboStar id, so a re-run finds
// it through its line item. An estimator split a line item that has more than one work item.
// The import cannot tell which of those work items the ArboStar values belong to. It leaves
// all of them and the line item price as they are. The import never writes a discount. The
// app owns discount_rate and discount_description on the line item and discount on the work
// item.
// Two kinds of line stay when they are gone from the export. One has more than one work item.
// The other has a work item that a clock session points at. Any other deleted line takes its
// work items with it, along with their equipment and work order links. It also takes its
// photo links and its imported photos (project_image rows with an arbostar_image_id). In-app
// photos linked to the line only lose the link.
export const import_line_items = async ({
	connection,
	write_helper,
	context,
	line_items,
	project_id_by_arbostar_lead_id,
}: {
	connection: Connection
	write_helper: TenantedWriteHelper
	context: ArbostarImportContext
	line_items: ArbostarLineItem[]
	project_id_by_arbostar_lead_id: Map<number, bigint>
}): Promise<ImportedLineItems> => {
	const with_project = filter(line_items, item => project_id_by_arbostar_lead_id.has(item.lead_id))
	const best_by_line_item_id = new Map<number, ArbostarLineItem>()
	for (const item of with_project) {
		const current = best_by_line_item_id.get(item.line_item_id)
		if (current === undefined || data_score(item) > data_score(current)) best_by_line_item_id.set(item.line_item_id, item)
	}
	const importable = [...best_by_line_item_id.values()]

	const work_type_id_by_name = new Map(context.existing.work_type_id_by_name)
	const normalized_work_type_name_to_new_work_type = new Map<string, { name: string; taxable: boolean }>()
	for (const item of importable) {
		if (item.service_name === null) continue
		const normalized_name = normalize_name(item.service_name)
		if (!work_type_id_by_name.has(normalized_name) && !normalized_work_type_name_to_new_work_type.has(normalized_name)) {
			normalized_work_type_name_to_new_work_type.set(normalized_name, { name: item.service_name.trim(), taxable: !item.non_taxable })
		}
	}
	const new_work_types = [...normalized_work_type_name_to_new_work_type.entries()]

	if (new_work_types.length > 0) {
		const work_type_rows = map(new_work_types, ([, { name, taxable }]) => ({
			name,
			taxable,
			hourly_rate: new_work_type_hourly_rate,
		}))
		const { insert_ids } = await write_helper.bulk_insert('work_type', work_type_rows, ROWS_PER_BATCH)
		for_each(new_work_types, ([normalized_name], index) => work_type_id_by_name.set(normalized_name, insert_ids[index]!))
	}

	const line_item_fields = (item: ArbostarLineItem) => ({
		project_id: project_id_by_arbostar_lead_id.get(item.lead_id)!,
		title: item.service_name?.trim() ?? '',
		taxable: !item.non_taxable,
		client_optional: item.optional || item.status === 'Declined',
		client_declined: item.status === 'Declined',
		sort: BigInt(item.sort_order),
	})

	const work_item_fields = (item: ArbostarLineItem) => ({
		work_type_id: item.service_name === null ? null : work_type_id_by_name.get(normalize_name(item.service_name))!,
		work_details: join_lines([
			item.description,
			item.size === null ? null : `Size: ${item.size}`,
			item.species === null ? null : `Species: ${item.species}`,
			item.reason === null ? null : `Reason: ${item.reason}`,
		]),
		estimated_crew_size: item.crew_role_ids.length === 0 ? default_values.project_line_item_work_item.estimated_crew_size : BigInt(item.crew_role_ids.length),
		estimated_hours: item.man_hours === null ? default_values.project_line_item_work_item.estimated_hours : arbostar_number_to_fnum(item.man_hours).changeDecimalPlaces(2),
		price: line_item_price(item),
	})

	const work_item_rows = await context.tenanted_select(connection, q => q
		.from('project_line_item_work_item')
		.select(() => ['project_line_item_work_item.project_line_item_work_item_id', 'project_line_item_work_item.project_line_item_id']))
	const work_items_by_project_line_item_id = group_by(
		map(work_item_rows, row => row.project_line_item_work_item),
		work_item => work_item.project_line_item_id,
	)
	const existing_work_items = (item: ArbostarLineItem) => {
		const project_line_item_id = context.existing.project_line_item_id_by_arbostar_line_item_id.get(item.line_item_id)
		return project_line_item_id === undefined ? [] : work_items_by_project_line_item_id.get(project_line_item_id) ?? []
	}

	const existing_items = filter(importable, item => context.existing.project_line_item_id_by_arbostar_line_item_id.has(item.line_item_id))
	const new_items = filter(importable, item => !context.existing.project_line_item_id_by_arbostar_line_item_id.has(item.line_item_id))
	const items_split_in_app = filter(importable, item => existing_work_items(item).length > 1)
	const items_with_one_work_item = filter(importable, item => existing_work_items(item).length === 1)
	const items_without_work_item = filter(importable, item => existing_work_items(item).length === 0)

	await write_helper.bulk_update({
		table_name: 'project_line_item',
		column: 'project_line_item_id',
		rows: map(existing_items, item => ({
			value: context.existing.project_line_item_id_by_arbostar_line_item_id.get(item.line_item_id)!,
			set: {
				...line_item_fields(item),
				price: existing_work_items(item).length > 1 ? undefined : line_item_price(item),
			},
		})),
		rows_per_batch: ROWS_PER_BATCH,
	})
	const project_line_item_id_by_arbostar_line_item_id = new Map(context.existing.project_line_item_id_by_arbostar_line_item_id)
	if (new_items.length > 0) {
		const { insert_ids } = await write_helper.bulk_insert(
			'project_line_item',
			map(new_items, item => ({
				...default_values.project_line_item,
				...line_item_fields(item),
				price: line_item_price(item),
				arbostar_line_item_id: BigInt(item.line_item_id),
			})),
			ROWS_PER_BATCH,
		)
		for_each(new_items, (item, index) => project_line_item_id_by_arbostar_line_item_id.set(item.line_item_id, insert_ids[index]!))
	}

	await write_helper.bulk_update({
		table_name: 'project_line_item_work_item',
		column: 'project_line_item_work_item_id',
		rows: map(items_with_one_work_item, item => ({
			value: existing_work_items(item)[0]!.project_line_item_work_item_id,
			set: work_item_fields(item),
		})),
		rows_per_batch: ROWS_PER_BATCH,
	})
	if (items_without_work_item.length > 0) {
		await write_helper.bulk_insert(
			'project_line_item_work_item',
			map(items_without_work_item, item => ({
				...default_values.project_line_item_work_item,
				...work_item_fields(item),
				project_line_item_id: project_line_item_id_by_arbostar_line_item_id.get(item.line_item_id)!,
				sort: 0n,
			})),
			ROWS_PER_BATCH,
		)
	}

	const incoming_id_list = map(importable, item => escape_value(item.line_item_id)).join(', ')
	const imported_project_ids = [...project_id_by_arbostar_lead_id.values()]
	const imported_project_id_list = map(imported_project_ids, escape_value).join(', ')

	const stale_line_item_filter = `project_line_item.company_id = ${escape_value(context.company_id)}`
		+ ' AND project_line_item.arbostar_line_item_id IS NOT NULL'
		+ ` AND project_line_item.project_id IN (${imported_project_id_list})`
		+ (importable.length > 0 ? ` AND project_line_item.arbostar_line_item_id NOT IN (${incoming_id_list})` : '')
	const stale = imported_project_ids.length === 0
		? { line_items_deleted: 0, line_items_kept: 0, work_items_deleted: 0, images_deleted: 0, object_keys: [] as string[] }
		: await (async () => {
			const [stale_rows] = await connection.query<RowDataPacket[]>({
				sql: 'SELECT project_line_item.project_line_item_id, project_image.original_object_key, project_image.display_object_key, project_image.thumbnail_object_key'
					+ ' FROM project_line_item'
					+ ' LEFT JOIN project_line_item_image ON project_line_item_image.project_line_item_id = project_line_item.project_line_item_id'
					+ ' LEFT JOIN project_image ON project_image.project_image_id = project_line_item_image.project_image_id AND project_image.arbostar_image_id IS NOT NULL'
					+ ` WHERE ${stale_line_item_filter}`,
				rowsAsArray: true,
			})
			const rows_no_longer_in_export = stale_rows as unknown as [bigint, string | null, string | null, string | null][]
			const clock_session_rows = await context.tenanted_select(connection, q => q
				.from('clock_session_project_line_item_work_item')
				.select(() => ['clock_session_project_line_item_work_item.project_line_item_work_item_id']))
			const work_item_ids_on_clock_sessions = new Set(map(clock_session_rows, row => row.clock_session_project_line_item_work_item.project_line_item_work_item_id))
			const app_owns_work_items = (project_line_item_id: bigint) => {
				const work_items = work_items_by_project_line_item_id.get(project_line_item_id) ?? []
				return work_items.length > 1 || some(work_items, work_item => work_item_ids_on_clock_sessions.has(work_item.project_line_item_work_item_id))
			}
			const rows = filter(rows_no_longer_in_export, row => !app_owns_work_items(row[0]))
			const stale_project_line_item_ids = [...new Set(map(rows, row => row[0]))]
			const stale_work_item_ids = flat_map(
				stale_project_line_item_ids,
				project_line_item_id => map(work_items_by_project_line_item_id.get(project_line_item_id) ?? [], work_item => work_item.project_line_item_work_item_id),
			)
			const image_rows = filter(rows, row => row[1] !== null)
			const object_keys = [...new Set(flat_map(image_rows, row => filter_map([row[1], row[2], row[3]], key => key)))]
			await write_helper.delete({ table_name: 'project_line_item_work_item_equipment', column: 'project_line_item_work_item_id', values: stale_work_item_ids, values_per_batch: ROWS_PER_BATCH })
			await write_helper.delete({ table_name: 'work_order_project_line_item_work_item', column: 'project_line_item_work_item_id', values: stale_work_item_ids, values_per_batch: ROWS_PER_BATCH })
			const { affected_rows: work_items_deleted } = await write_helper.delete({ table_name: 'project_line_item_work_item', column: 'project_line_item_id', values: stale_project_line_item_ids, values_per_batch: ROWS_PER_BATCH })
			if (stale_project_line_item_ids.length > 0) {
				await connection.query<ResultSetHeader>(
					'DELETE project_line_item, project_line_item_image, project_image'
					+ ' FROM project_line_item'
					+ ' LEFT JOIN project_line_item_image ON project_line_item_image.project_line_item_id = project_line_item.project_line_item_id'
					+ ' LEFT JOIN project_image ON project_image.project_image_id = project_line_item_image.project_image_id AND project_image.arbostar_image_id IS NOT NULL'
					+ ` WHERE project_line_item.company_id = ${escape_value(context.company_id)}`
					+ ` AND project_line_item.project_line_item_id IN (${map(stale_project_line_item_ids, escape_value).join(', ')})`,
				)
			}
			return {
				line_items_deleted: stale_project_line_item_ids.length,
				line_items_kept: new Set(map(rows_no_longer_in_export, row => row[0])).size - stale_project_line_item_ids.length,
				work_items_deleted: Number(work_items_deleted),
				images_deleted: image_rows.length,
				object_keys,
			}
		})()

	return {
		project_line_item_id_by_arbostar_line_item_id,
		deleted_object_keys: stale.object_keys,
		counts: {
			work_types_inserted: new_work_types.length,
			project_line_items_inserted: new_items.length,
			project_line_items_updated: existing_items.length,
			project_line_items_deleted: stale.line_items_deleted,
			project_images_deleted_with_line_items: stale.images_deleted,
			project_line_item_work_items_inserted: items_without_work_item.length,
			project_line_item_work_items_updated: items_with_one_work_item.length,
			project_line_item_work_items_deleted: stale.work_items_deleted,
			project_line_items_split_in_app: items_split_in_app.length,
			project_line_items_kept_no_longer_in_export: stale.line_items_kept,
			skipped_line_items_without_project: line_items.length - with_project.length,
			duplicate_line_items_dropped: with_project.length - importable.length,
		},
	}
}
