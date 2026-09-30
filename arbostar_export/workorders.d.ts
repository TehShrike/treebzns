// Shape of one element in arbostar_export/workorders.js (see export_workorders.ts).
// `client_id` links back to clients.js; `lead_id` to leads.js.
// Unions enumerate the values observed in the July 2026 export (see estimates.d.ts).
// Statuses beyond the built-in first three are tenant-defined scheduling buckets.

// The id → name pairing is fixed: 0 Finished, 1 Confirmed online, 2 Confirmed,
// 5 Stump Grinding, 10 On hold, 13 Winter Schedule, 15 Summer PHC, 16 Planting, 17 Fall PHC.
export type ArbostarWorkOrderStatusId = 0 | 1 | 2 | 5 | 10 | 13 | 15 | 16 | 17
export type ArbostarWorkOrderStatusName =
	| 'Finished'
	| 'Confirmed online'
	| 'Confirmed'
	| 'On hold'
	| 'Winter Schedule'
	| 'Summer PHC'
	| 'Planting'
	| 'Stump Grinding'
	| 'Fall PHC'

export type ArbostarWorkOrder = {
	workorder_id: number
	workorder_no: string
	date_created: string
	status: ArbostarWorkOrderStatusName
	wo_status_id: ArbostarWorkOrderStatusId
	/** Estimator display name; an empty array (API quirk) when unassigned. */
	estimator: string | []
	office_notes: string
	/** MM/DD/YYYY local date of the latest status change; on Finished rows, the finish date. */
	latest_status_update: string
	client_id: number
	client_name: string
	lead_id: number
	lead_address: string
	total_price: number
	total_done: number
	total_completed_not_invoiced: number
	total_invoiced: number
	total_scheduled: number
	total_unscheduled: number
	man_hours_total: number | null
	man_hours_done: number
	man_hours_invoiced: number | null
	man_hours_scheduled: number | null
	man_hours_unscheduled: number
	/** ISO instant of the latest status change. The exact time behind latest_status_update. */
	latest_status_changed_at: string | null
	/** ArboStar user id of the user who made the latest status change. 0 on 177 of 1040 rows (September 2026), probably changes that ArboStar made itself. */
	latest_status_changed_by_user_id: number | null
	/** ArboStar user id of the lead's estimator. */
	estimator_user_id: number | null
	/** The lead's coordinates. */
	latitude: number | null
	longitude: number | null
}

// workorders.js is an ESM module whose default export is the full array of records.
declare const workorders: ArbostarWorkOrder[]
export default workorders
