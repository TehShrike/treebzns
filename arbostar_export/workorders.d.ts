// Shape of one element in arbostar_export/workorders.js (see export_workorders.ts).
// `client_id` links back to clients.js; `lead_id` to leads.js.
export type ArbostarWorkOrder = {
	workorder_id: number
	workorder_no: string | null
	date_created: string | null
	status: string | null
	wo_status_id: number | null
	estimator: string | null | []
	office_notes: string | null
	latest_status_update: string | null
	client_id: number | null
	client_name: string | null
	lead_id: number | null
	lead_address: string | null
	total_price: number | null
	total_done: number | null
	total_completed_not_invoiced: number | null
	total_invoiced: number | null
	total_scheduled: number | null
	total_unscheduled: number | null
	man_hours_total: number | null
	man_hours_done: number | null
	man_hours_invoiced: number | null
	man_hours_scheduled: number | null
	man_hours_unscheduled: number | null
}

// workorders.js is an ESM module whose default export is the full array of records.
declare const workorders: ArbostarWorkOrder[]
export default workorders
