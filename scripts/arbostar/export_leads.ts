// Run-now export: pulls every ArboStar lead and writes leads.json into arbostar_export/.
//
//   node scripts/arbostar/export_leads.ts
//
// The lead list is status-scoped; status_ids[]=-1 only returns active leads (most leads
// convert to status "Estimated" and drop out of that view), so we union across every status
// id to get the full history. Auth comes from ./session.ts; shape from ./leads.d.ts.
//
// The lead source ("Referred by" in the lead form) is not on the datatable rows — the full
// lead entity only carries the source *id* (lead_reffered_by), and no codebook endpoint for
// it has turned up. The BI KPI New Leads report resolves the names, so a second pass over
// GET /business_intelligence/kpi_new_leads/datatables (a standard GET datatable, scoped by a
// report_date range instead of statuses) joins referred_by / referred_by_name on by lead_id.
//
// The free-text detail behind the "Other" source choice (lead_source_details) only exists on
// the full lead entity, and sampling shows it is null on every non-"Other" lead — so a third
// pass fetches the (large) editor payload for just the "Other" leads.

import { fetch_all_rows, fetch_all_rows_every_status } from './fetch_datatable.ts'
import { fetch_json, map_with_concurrency } from './fetch_record.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import type { ArbostarLead } from '#arbostar_export/leads.d.ts'

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
	estimator: { full_name: string | null | [] } | null
	utm_source: string | null
	utm_medium: string | null
	utm_campaign: string | null
	utm_term: string | null
	utm_content: string | null
	utm_referral: string | null
	gclid: string | null
	form_id: string | null
}

type ArboStarKpiNewLeadsRow = {
	lead_id: number
	referred_by: string | null
	referred_by_name: string | null
}

function to_export(
	lead: ArboStarLead,
	referral: ArboStarKpiNewLeadsRow | undefined,
	lead_source_details: string | null,
): ExportShape<ArbostarLead> {
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
		referred_by: referral?.referred_by ?? null,
		referred_by_name: referral?.referred_by_name ?? null,
		lead_source_details,
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

const referral_rows = await fetch_all_rows<ArboStarKpiNewLeadsRow>({
	path: '/business_intelligence/kpi_new_leads/datatables',
	order: { column_index: 1, column_name: 'lead_date_created', dir: 'desc' },
	extra_params: {
		report_date_from: '01/01/2015',
		report_date_to: '12/31/2099',
		estimators: '',
	},
	base_url: BASE_URL,
	headers: AUTH_HEADERS,
	on_progress: (fetched, total) => console.log(`  fetched ${fetched} / ${total} lead referrals`),
})
const referral_by_lead_id = new Map(referral_rows.map(row => [row.lead_id, row]))

const other_lead_ids = leads
	.map(lead => lead.lead_id)
	.filter(lead_id => referral_by_lead_id.get(lead_id)?.referred_by === 'Other')
const detail_entries = await map_with_concurrency(
	other_lead_ids,
	6,
	async lead_id => {
		const data = await fetch_json<{ lead: { lead_source_details: string | null } }>(
			`/estimates/edit/${lead_id}`,
			{ base_url: BASE_URL, headers: AUTH_HEADERS },
		)
		return [lead_id, data.lead.lead_source_details] as const
	},
	(done, total) => console.log(`  fetched ${done} / ${total} lead source details`),
)
const details_by_lead_id = new Map(detail_entries)

const exported = leads.map(lead => to_export(
	lead,
	referral_by_lead_id.get(lead.lead_id),
	details_by_lead_id.get(lead.lead_id) ?? null,
))
console.log(`Wrote ${exported.length} leads -> ${write_output('leads.js', exported)}`)
