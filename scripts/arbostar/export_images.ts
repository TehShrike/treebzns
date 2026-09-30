// Run-now export: downloads the line item photos of every active lead into
// arbostar_export/images/ and writes images.js. Run export_estimates.ts and
// export_workorders.ts first (this reads both).
//
//   node scripts/arbostar/export_images.ts
//
// Active leads are defined in leads_to_download_images_for.ts; the import reuses it to scope photo deletes.
//
// The photos are the `files` on each line item of the estimate profile. Their full_path
// downloads from the account origin with no auth. A photo already on disk is not downloaded
// again. The export writes each photo to a .part file and renames it after the download
// finishes, so a file on disk is always complete. The file's filesize in the profile can be
// stale, so the download is checked against the response's content-length instead.

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { filter, flat_map, map } from '#shared/array.ts'
import { leads_to_download_images_for } from './leads_to_download_images_for.ts'
import { services_of } from './estimate_services.ts'
import type { ArboStarServiceFile, EstimateServices } from './estimate_services.ts'
import { fetch_json, map_with_concurrency } from './fetch_record.ts'
import { read_output, write_output } from './output.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarImage } from '#arbostar_export/images.d.ts'
import type { ArbostarWorkOrder } from '#arbostar_export/workorders.d.ts'

const IMAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'arbostar_export', 'images')

type EstimateProfile = { lead?: { estimate?: EstimateServices | null } | null }

const estimates = await read_output<ArbostarEstimate[]>('estimates.js')
const workorders = await read_output<ArbostarWorkOrder[]>('workorders.js')

const { lead_ids, description } = leads_to_download_images_for(estimates, workorders, new Date())
console.log(description)

const to_image = (file: ArboStarServiceFile, line_item_id: number, lead_id: number): Omit<ArbostarImage, 'filesize'> => {
	assert.equal(file.owner_id, line_item_id, `file ${file.id} belongs to the line item that lists it`)
	return {
		image_id: file.id,
		line_item_id,
		lead_id,
		local_path: `images/${file.id}.${file.extension.toLowerCase()}`,
		original_filename: file.original_filename,
		content_type: file.type,
		arbostar_path: file.full_path,
		uploaded_by_user_id: file.user_id,
		sort_order: file.sort_order,
		created: file.system_create,
		updated: file.system_update,
		can_be_in_pdf: file.can_be_in_pdf,
		in_estimate_pdf: file.is_estimate_pdf,
		in_workorder_pdf: file.is_workorder_pdf,
		in_invoice_pdf: file.is_invoice_pdf,
		shared: file.is_shared,
	}
}

const per_lead = await map_with_concurrency(
	lead_ids,
	6,
	async lead_id => {
		const profile = await fetch_json<EstimateProfile>(`/estimates/profile/profileData/${lead_id}`, { base_url: BASE_URL, headers: AUTH_HEADERS })
		const { services } = services_of(profile.lead?.estimate)
		return flat_map(services, service => map(service.files ?? [], file => to_image(file, service.id, lead_id)))
	},
	(done, total) => {
		if (done % 50 === 0 || done === total) console.log(`  ${done} / ${total} estimate profiles`)
	},
)
const all_files = per_lead.flat()
const images = filter(all_files, file => file.content_type.startsWith('image/'))
assert.equal(new Set(map(images, image => image.image_id)).size, images.length, 'every image has a unique image_id')
console.log(`${images.length} images on ${new Set(map(images, image => image.line_item_id)).size} line items (${all_files.length - images.length} other files skipped)`)

mkdirSync(IMAGES_DIR, { recursive: true })
let downloaded = 0
const images_with_size = await map_with_concurrency(
	images,
	6,
	async (image): Promise<ArbostarImage> => {
		const path = join(IMAGES_DIR, '..', image.local_path)
		if (existsSync(path)) {
			return { ...image, filesize: statSync(path).size }
		}
		const response = await fetch(`${BASE_URL}/${image.arbostar_path}`)
		assert(response.ok, `GET ${image.arbostar_path} responds ok — got ${response.status}`)
		const bytes = new Uint8Array(await response.arrayBuffer())
		assert.equal(String(bytes.byteLength), response.headers.get('content-length'), `${image.arbostar_path} downloads at its content-length`)
		writeFileSync(`${path}.part`, bytes)
		renameSync(`${path}.part`, path)
		downloaded += 1
		return { ...image, filesize: bytes.byteLength }
	},
	(done, total) => {
		if (done % 50 === 0 || done === total) console.log(`  ${done} / ${total} images`)
	},
)
console.log(`Downloaded ${downloaded} images (${images.length - downloaded} already on disk) -> ${IMAGES_DIR}`)
console.log(`Wrote ${images.length} images -> ${write_output('images.js', images_with_size)}`)
