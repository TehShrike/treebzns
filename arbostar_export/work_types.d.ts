// Shape of one element in arbostar_export/work_types.js (see export_work_types.ts).
// One row per pruning work type (the `ip_*` catalog: Clean canopy, Crown reduction, ...).
// These attach to tree inventory entries, not to line items — no export references them yet.
export type ArbostarWorkType = {
	ip_id: number
	/** Short code, e.g. 'CC', 'CR', 'XX'. */
	ip_name_short: string
	/** Display name, e.g. 'Clean canopy', 'Crown reduction', 'Remove'. */
	ip_name: string
	/** Display sort order in the app. */
	priority: number
	deleted_at: string | null
}

// work_types.js is an ESM module whose default export is the full array of records.
declare const workTypes: ArbostarWorkType[]
export default workTypes
