// Run-now export: pulls every ArboStar lead and writes leads.json into arbostar_export/.
//
//   node scripts/arbostar/export_leads.ts
//
// The lead list is status-scoped; status_ids[]=-1 only returns active leads (most leads
// convert to status "Estimated" and drop out of that view), so we union across every status
// id to get the full history. Auth comes from ./session.ts; shape from ./leads.d.ts.

import { fetch_all_rows_every_status } from './fetch_datatable.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { write_output } from './output.ts'
import type { Lead } from './types/leads.d.ts'

type ArboStarLead = {
	lead_id: number
	lead_no: string | null
	lead_date_created: string | null
	lead_priority: string | null
	lead_assigned_date: string | null
	lead_postpone_date: string | null
	lead_created_by: string | null
	lead_status_id: number | null
	lead_status_name: string | null
	lead_reason_status_id: number | null
	lead_address: string | null
	address_line_display: string | null
	client: { client_id: number; client_name: string | null } | null
	estimator: { full_name: string | null } | null
	utm_source: string | null
	utm_medium: string | null
	utm_campaign: string | null
	utm_term: string | null
	utm_content: string | null
	utm_referral: string | null
	gclid: string | null
	form_id: string | null
}

function to_export(lead: ArboStarLead): Lead {
	return {
		lead_id: lead.lead_id,
		lead_no: lead.lead_no,
		lead_date_created: lead.lead_date_created,
		lead_priority: lead.lead_priority,
		lead_assigned_date: lead.lead_assigned_date,
		lead_postpone_date: lead.lead_postpone_date,
		lead_created_by: lead.lead_created_by,
		lead_status_id: lead.lead_status_id,
		lead_status_name: lead.lead_status_name,
		lead_reason_status_id: lead.lead_reason_status_id,
		client_id: lead.client?.client_id ?? null,
		client_name: lead.client?.client_name ?? null,
		estimator: lead.estimator?.full_name ?? null,
		lead_address: lead.lead_address,
		address_line_display: lead.address_line_display,
		utm_source: lead.utm_source,
		utm_medium: lead.utm_medium,
		utm_campaign: lead.utm_campaign,
		utm_term: lead.utm_term,
		utm_content: lead.utm_content,
		utm_referral: lead.utm_referral,
		gclid: lead.gclid,
		form_id: lead.form_id,
	}
}

const leads = await fetch_all_rows_every_status<ArboStarLead>({
	path: '/leads',
	order: { column_index: 0, column_name: 'lead_id', dir: 'desc' },
	status_id_field: 'lead_status_id',
	primary_key: lead => lead.lead_id,
	base_url: BASE_URL,
	headers: AUTH_HEADERS,
	on_progress: fetched => console.log(`  fetched ${fetched} leads`),
})

const exported = leads.map(to_export)
console.log(`Wrote ${exported.length} leads -> ${write_output('leads.json', exported)}`)
