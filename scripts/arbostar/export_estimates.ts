// Run-now export: pulls every ArboStar estimate and writes estimates.json into
// arbostar_export/.
//
//   node scripts/arbostar/export_estimates.ts
//
// Auth comes from ./session.ts; output shape from ./estimates.d.ts. We union across all
// statuses (see fetch_datatable.ts) to capture confirmed/declined/expired history, not just
// the default view.

import { fetch_all_rows_every_status } from './fetch_datatable.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { write_output } from './output.ts'
import type { Estimate } from './types/estimates.d.ts'

type ArboStarEstimate = {
	estimate_id: number
	estimate_no: string | null
	lead_id: number | null
	date_created_view: string | null
	total_price: number | null
	status: number | null
	estimate_status: { est_status_name: string | null } | null
	client: { client_id: number; client_name: string | null } | null
	user: { firstname: string | null; lastname: string | null } | null
	lead: { lead_address: string | null } | null
	email: { email_status: string | null; email_created_at: string | null } | null
}

function full_name(first: string | null | undefined, last: string | null | undefined): string | null {
	const name = [first, last].filter(Boolean).join(' ').trim()
	return name === '' ? null : name
}

function to_export(estimate: ArboStarEstimate): Estimate {
	return {
		estimate_id: estimate.estimate_id,
		estimate_no: estimate.estimate_no,
		lead_id: estimate.lead_id,
		date_created: estimate.date_created_view,
		total_price: estimate.total_price,
		status_id: estimate.status,
		status_name: estimate.estimate_status?.est_status_name ?? null,
		client_id: estimate.client?.client_id ?? null,
		client_name: estimate.client?.client_name ?? null,
		estimator: full_name(estimate.user?.firstname, estimate.user?.lastname),
		lead_address: estimate.lead?.lead_address ?? null,
		email_status: estimate.email?.email_status ?? null,
		email_created_at: estimate.email?.email_created_at ?? null,
	}
}

const estimates = await fetch_all_rows_every_status<ArboStarEstimate>({
	path: '/estimates',
	order: { column_index: 5, column_name: 'date_created', dir: 'desc' },
	status_id_field: 'est_status_id',
	primary_key: estimate => estimate.estimate_id,
	base_url: BASE_URL,
	headers: AUTH_HEADERS,
	on_progress: fetched => console.log(`  fetched ${fetched} estimates`),
})

const exported = estimates.map(to_export)
console.log(`Wrote ${exported.length} estimates -> ${write_output('estimates.json', exported)}`)
