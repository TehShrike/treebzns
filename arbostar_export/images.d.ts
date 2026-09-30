// Shape of one element in arbostar_export/images.js (see export_images.ts).
// One row per photo on an estimate line item. `line_item_id` links to line_items.js and
// `lead_id` to leads.js. The photo itself is at arbostar_export/<local_path>.
// Only active leads are exported: every work order that is not Finished, every estimate
// that is Draft / Unsent or Contact the client, and Sent for approval estimates created in
// the last 30 days.

export type ArbostarImage = {
	/** ArboStar's file id. */
	image_id: number
	line_item_id: number
	lead_id: number
	/** 'images/<image_id>.<extension>' */
	local_path: string
	original_filename: string
	/** e.g. 'image/jpeg' */
	content_type: string
	/** Bytes on disk. The profile's own filesize is stale for some photos. */
	filesize: number
	/** The ArboStar path, relative to the account origin. It downloads with no auth. */
	arbostar_path: string
	/** ArboStar user id of the uploader. */
	uploaded_by_user_id: number | null
	sort_order: number | null
	/** 'YYYY-MM-DD HH:MM:SS', company-local */
	created: string | null
	/** 'YYYY-MM-DD HH:MM:SS', company-local */
	updated: string | null
	can_be_in_pdf: boolean
	in_estimate_pdf: boolean
	in_workorder_pdf: boolean
	in_invoice_pdf: boolean
	shared: boolean
}

// images.js is an ESM module whose default export is the full array of records.
declare const images: ArbostarImage[]
export default images
