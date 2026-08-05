// Run-now export: pulls every declined estimate's decline reason and writes declines.js into
// arbostar_export/.
//
//   node scripts/arbostar/export_declines.ts
//
// The Decline Reasons report (/estimates/declines) is the only place decline reasons exist as
// data — the estimate list rows don't carry them, and the per-record editor costs one ~355 KB
// fetch each. It speaks the usual DataTables protocol but requires a from/to date range, so we
// pass one wide enough to cover everything. Auth comes from ./session.ts; output shape from
// #arbostar_export/declines.d.ts.

import { fetch_all_rows } from './fetch_datatable.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import type { ArbostarDecline } from '#arbostar_export/declines.d.ts'

type ArboStarDeclineRow = {
	estimate_id: number
	estimate_no: string | null
	client_id: number
	client_name: string | null
	date_created: number | null
	date_created_view: string | null
	estimate_reason_decline: number | null
	reason_name: string | null
	total_price: number | null
}

function to_export(row: ArboStarDeclineRow): ExportShape<ArbostarDecline> {
	return {
		estimate_id: row.estimate_id,
		estimate_no: row.estimate_no,
		client_id: row.client_id,
		client_name: row.client_name,
		date_created: row.date_created_view,
		date_created_unix: row.date_created,
		reason_id: row.estimate_reason_decline,
		reason_name: row.reason_name || null,
		total_price: row.total_price,
	}
}

const declines = await fetch_all_rows<ArboStarDeclineRow>({
	path: '/estimates/declines',
	order: { column_index: 3, column_name: 'date_created', dir: 'desc' },
	extra_params: { from: '01/01/2015', to: '12/31/2099', status_reason_ids_mode: 'and' },
	base_url: BASE_URL,
	headers: AUTH_HEADERS,
	on_progress: (fetched, total) => console.log(`  fetched ${fetched} / ${total} declines`),
})

const exported = declines.map(to_export)
console.log(`Wrote ${exported.length} declines -> ${write_output('declines.js', exported)}`)
