// Run-now export: pulls the service line items for every estimate and writes
// line_items.json into arbostar_export/. Run export_estimates.ts first (this reads the
// lead ids from estimates.json).
//
//   node scripts/arbostar/export_line_items.ts
//
// Line items only exist behind the estimate EDITOR, which is keyed by LEAD id (not
// estimate id) at /estimates/edit/{lead_id}; the rows live at lead.estimate.estimates_service.
// Each row carries estimate_id + invoice_id, so this one pass covers quotes, invoices, and
// work orders. The editor payload is ~355 KB each (it re-sends the whole service catalog),
// so this is the slow export. Auth comes from ./session.ts; shape from ./types/line_items.d.ts.

import { fetch_json, map_with_concurrency } from './fetch_record.ts'
import { read_output, write_output } from './output.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import type { Estimate } from './types/estimates.d.ts'
import type { LineItem } from './types/line_items.d.ts'

type ArboStarService = {
	id: number
	estimate_id: number | null
	invoice_id: number | null
	service_id: number | null
	service_description: string | null
	quantity: number | null
	service_price: number | string | null
	cost: number | string | null
	service_time: number | null
	service_size: string | null
	service_species: string | null
	service_reason: string | null
	optional: number | null
	is_fee: number | null
	is_additional_work: number | null
	non_taxable: number | null
	sort_order: number | null
	service_crews: string | null
	service: { service_name: string | null } | null
	status: { services_status_name: string | null } | null
}

type EstimateEditor = {
	lead?: { estimate?: { estimates_service?: ArboStarService[] } | null } | null
}

const number_or_null = (value: number | string | null | undefined): number | null =>
	value == null || value === '' ? null : Number(value)

function to_line_item(service: ArboStarService, lead_id: number): LineItem {
	return {
		line_item_id: service.id,
		lead_id,
		estimate_id: service.estimate_id,
		invoice_id: service.invoice_id,
		service_id: service.service_id,
		service_name: service.service?.service_name ?? null,
		description: service.service_description,
		quantity: number_or_null(service.quantity),
		price: number_or_null(service.service_price),
		cost: number_or_null(service.cost),
		man_hours: number_or_null(service.service_time),
		size: service.service_size || null,
		species: service.service_species || null,
		reason: service.service_reason || null,
		optional: service.optional === 1,
		is_fee: service.is_fee === 1,
		is_additional_work: service.is_additional_work === 1,
		non_taxable: service.non_taxable === 1,
		status: service.status?.services_status_name ?? null,
		crews: service.service_crews || null,
		sort_order: service.sort_order,
	}
}

const estimates = read_output<Estimate[]>('estimates.json')
const lead_ids = [...new Set(estimates.map(e => e.lead_id).filter((id): id is number => id != null))]
console.log(`Fetching line items for ${lead_ids.length} estimates (by lead id)...`)

let failures = 0
const per_estimate = await map_with_concurrency(
	lead_ids,
	6,
	async (lead_id): Promise<LineItem[]> => {
		try {
			const editor = await fetch_json<EstimateEditor>(`/estimates/edit/${lead_id}`, { base_url: BASE_URL, headers: AUTH_HEADERS })
			const services = editor.lead?.estimate?.estimates_service ?? []
			return services.map(service => to_line_item(service, lead_id))
		} catch (error) {
			failures += 1
			console.log(`  ! lead ${lead_id}: ${(error as Error).message}`)
			return []
		}
	},
	(done, total) => {
		if (done % 100 === 0 || done === total) console.log(`  ${done} / ${total} estimates`)
	},
)

const line_items = per_estimate.flat()
const path = write_output('line_items.json', line_items)
console.log(`Wrote ${line_items.length} line items from ${lead_ids.length - failures} estimates -> ${path}`)
if (failures > 0) console.log(`(${failures} estimates failed to fetch)`)
