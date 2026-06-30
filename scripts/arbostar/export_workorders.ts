// Run-now export: pulls every ArboStar work order (project) and writes workorders.json
// into arbostar_export/.
//
//   node scripts/arbostar/export_workorders.ts
//
// `status_ids[]=-1` bypasses the UI's default "Confirmed" status filter so we get the full
// history (~835) rather than the 25 shown on screen. Auth comes from ./session.ts; the
// output shape is declared in ./workorders.d.ts.

import { fetch_all_rows_every_status } from './fetch_datatable.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { write_output } from './output.ts'
import type { WorkOrder } from './types/workorders.d.ts'

type ArboStarWorkOrder = {
	id: number
	workorder_no: string | null
	date_created: string | null
	status: string | null
	wo_status_id: number | null
	estimator: string | null
	estimate_office_notes: string | null
	latest_status_update: string | null
	lead_id: number | null
	lead_address: string | null
	client: { client_id: number; client_name: string | null } | null
	total_price: number | null
	total_done: number | null
	total_completed_not_invoiced: number | null
	total_invoiced: number | null
	total_scheduled: number | null
	total_unscheduled: number | null
	mh_total_all: number | null
	mh_total_done: number | null
	mh_total_invoiced: number | null
	mh_total_scheduled: number | null
	mh_total_unscheduled: number | null
}

function to_export(wo: ArboStarWorkOrder): WorkOrder {
	return {
		workorder_id: wo.id,
		workorder_no: wo.workorder_no,
		date_created: wo.date_created,
		status: wo.status,
		wo_status_id: wo.wo_status_id,
		estimator: wo.estimator,
		office_notes: wo.estimate_office_notes,
		latest_status_update: wo.latest_status_update,
		client_id: wo.client?.client_id ?? null,
		client_name: wo.client?.client_name ?? null,
		lead_id: wo.lead_id,
		lead_address: wo.lead_address,
		total_price: wo.total_price,
		total_done: wo.total_done,
		total_completed_not_invoiced: wo.total_completed_not_invoiced,
		total_invoiced: wo.total_invoiced,
		total_scheduled: wo.total_scheduled,
		total_unscheduled: wo.total_unscheduled,
		man_hours_total: wo.mh_total_all,
		man_hours_done: wo.mh_total_done,
		man_hours_invoiced: wo.mh_total_invoiced,
		man_hours_scheduled: wo.mh_total_scheduled,
		man_hours_unscheduled: wo.mh_total_unscheduled,
	}
}

const workorders = await fetch_all_rows_every_status<ArboStarWorkOrder>({
	path: '/workorders',
	order: { column_index: 6, column_name: 'date_created', dir: 'desc' },
	status_id_field: 'wo_status_id',
	primary_key: wo => wo.id,
	base_url: BASE_URL,
	headers: AUTH_HEADERS,
	on_progress: fetched => console.log(`  fetched ${fetched} work orders`),
})

const exported = workorders.map(to_export)
console.log(`Wrote ${exported.length} work orders -> ${write_output('workorders.json', exported)}`)
