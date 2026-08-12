import type { Connection } from 'mysql2/promise'
import type { FinancialNumber } from 'financial-number'
import type { ArbostarLead } from '#arbostar_export/leads.d.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarWorkOrder } from '#arbostar_export/workorders.d.ts'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import type { ArbostarDecline } from '#arbostar_export/declines.d.ts'
import type { ArbostarTax } from '#arbostar_export/taxes.d.ts'
import { map, filter, every, some } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import arbostar_number_to_fnum from './arbostar_number_to_fnum.ts'
import { write_helper, ROWS_PER_BATCH, group_by, join_lines, money, money_display, normalize_name, string_or_null } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import type { ImportedClients } from './import_clients.ts'

export type ImportedProjects = {
	project_id_by_arbostar_lead_id: Map<number, bigint>
	counts: {
		tax_rates_inserted: number
		projects_inserted: number
		projects_updated: number
		projects_no_longer_in_export: number
		skipped_leads_without_client: number
	}
}

const describe_estimate = (estimate: ArbostarEstimate, decline: ArbostarDecline | undefined): string =>
	`Estimate ${estimate.estimate_no ?? estimate.estimate_id}`
	+ (estimate.status_name === null ? '' : ` (${estimate.status_name}${decline?.reason_name ? ` — ${decline.reason_name}` : ''})`)
	+ (estimate.total_price === null ? '' : `: ${money_display(estimate.total_price)}`)

const describe_workorder = (workorder: ArbostarWorkOrder): string =>
	`Work order ${workorder.workorder_no ?? workorder.workorder_id}`
	+ (workorder.status === null ? '' : ` (${workorder.status})`)
	+ (workorder.total_price === null ? '' : `: ${money_display(workorder.total_price)}`)

const describe_invoice = (invoice: ArbostarInvoice): string =>
	`Invoice ${invoice.invoice_no ?? invoice.invoice_id}`
	+ (invoice.total_including_tax === null ? '' : `: ${money_display(invoice.total_including_tax)}`)
	+ (invoice.amount_paid === null ? '' : `, paid ${money_display(invoice.amount_paid)}`)

// Every lead/estimate/workorder/invoice number shares the lead's integer, suffixed by a stage
// letter (123-L / 123-E / 123-W / 123-I); the integer becomes the user-facing project.number.
const lead_number = (lead: ArbostarLead): bigint => {
	const match = lead.lead_no === null ? null : /^(\d+)-/.exec(lead.lead_no)
	assert(match, `Lead ${lead.lead_id} must have a parseable lead_no – found: "${lead.lead_no}"`)
	return BigInt(match[1]!)
}

// ArboStar lead statuses (see scripts/arbostar/readme.md): 1 New · 3 No Go · 4 Estimated · 5 Draft.
const ARBOSTAR_LEAD_STATUS_NO_GO = 3
const ARBOSTAR_LEAD_STATUS_NEW = 1
const ARBOSTAR_LEAD_STATUS_DRAFT = 5
// An estimate was sent to the client if its email has any delivery tracking (email_status) —
// statuses alone undercount, because sent-then-resolved estimates move on to Confirmed /
// Declined / Expired. The status check still matters for the handful marked sent without
// email tracking (sent by other means).
// ArboStar estimate statuses: 2 Sent for approval · 3 Pending approval.
const ARBOSTAR_ESTIMATE_STATUSES_SENT = [2, 3]
// Row-level ids (the readme's status-tab table differs: Declined is -4 there):
// 4 Declined · 8 Thinking – No Follow Up Needed · 9 Expired.
const ARBOSTAR_ESTIMATE_STATUS_DECLINED = 4
const ARBOSTAR_ESTIMATE_STATUSES_DEAD = [ARBOSTAR_ESTIMATE_STATUS_DECLINED, 8, 9]
// Matched on the row-level status name: work order rows use a different status-id space than
// the status tabs documented in scripts/arbostar/readme.md (finished rows carry wo_status_id 0,
// not the tab table's 7).
const ARBOSTAR_WO_STATUS_FINISHED = 'Finished'
// ArboStar's canned decline reasons → the seeded project_decline_reason rows, both sides
// normalized (see normalize_name and the mapping table in
// 2026-08-03-project-status-work-plan.md). ArboStar reasons with no natural seed equivalent
// import with a null reason id; the reason name still survives in lead_details prose.
const SEED_DECLINE_REASON_BY_ARBOSTAR_REASON = new Map([
	['price is too high', 'price too high'],
	['preferred the competition', 'went with a lower bid'],
	['scheduling delays/conflicts', 'scheduling troubles'],
	[`client can't be pleased`, `weren't pleased`],
])

// The export only carries tax *amounts*, so a project's rate is recovered by implying it from
// the invoice tax over the taxable line sum and snapping to the nearest entry in the company's
// official tax list (taxes.js). ArboStar reuses bare tax names across rates ("Tax" at both 0%
// and 5.5%), so the created tax_rate rows embed the rate in the name ("Tax (5.5%)") to satisfy
// the unique (company_id, name) key. tax_rate.tax_rate stores the ratio (0.0550), not the
// percentage — at the tax_rate column's 4 decimal places.
type OfficialTax = { name: string; ratio: FinancialNumber }

const official_tax_list = (taxes: ArbostarTax[]): OfficialTax[] =>
	map(taxes, tax => ({
		name: `${tax.name} (${tax.value}%)`.trim(),
		ratio: arbostar_number_to_fnum(tax.value).times('0.01').changeDecimalPlaces(4),
	}))

// The taxable, non-declined line sum is what ArboStar applied the rate to, so it recovers the
// exact rate on partially non-taxable invoices, where dividing by the invoice total would
// blend the rate down. Leads whose lines are missing from the export fall back to the invoice
// sums; invoice-level discounts live on neither base, so both can still land slightly off the
// real rate — the snap absorbs that.
const implied_tax_ratio = (invoices: ArbostarInvoice[], lines: ArbostarLineItem[]): number => {
	const tax = invoices.reduce((sum, invoice) => sum + (invoice.tax ?? 0), 0)
	if (tax <= 0) return 0
	const taxable_line_sum = filter(lines, line => !line.non_taxable && line.status !== 'Declined')
		.reduce((sum, line) => sum + (line.price ?? 0) * (line.quantity ?? 1), 0)
	const base = taxable_line_sum > 0
		? taxable_line_sum
		: invoices.reduce((sum, invoice) => sum + (invoice.total_including_tax ?? 0), 0) - tax
	return base > 0 ? tax / base : 0
}

// Selection only — no rounding happens here, so comparing as floats is fine (implied is
// already a float heuristic).
const nearest_official_tax = (official_taxes: OfficialTax[], implied: number): OfficialTax => {
	assert(official_taxes.length > 0, 'the official tax list has at least one entry')
	const distance = (entry: OfficialTax) => Math.abs(Number(entry.ratio.toString()) - implied)
	return official_taxes.reduce((best, entry) => (distance(entry) < distance(best) ? entry : best))
}

type ProjectTax =
	| { taxable: true; tax_rate_id: bigint; tax_rate: FinancialNumber }
	| { taxable: false; tax_rate_id: null; tax_rate: null }

const NOT_TAXABLE: ProjectTax = { taxable: false, tax_rate_id: null, tax_rate: null }

// One project per ArboStar lead — this schema models the whole lead → estimate → work order
// pipeline as a single project moving between project documents, so the related estimates,
// work orders, and invoices choose the document stage and are summarized into lead_details.
// Update-or-insert: `project.number` (the parsed lead integer) is the correlation, and updates
// only touch the ArboStar-derived columns — locally-populated ones (due_date, emergency,
// notes_for_crew, closed_at/closed_date, created_by_employee_id) are left alone. `closed` means
// "no more work to do" (payment state is the billing system's concern, tracked separately as
// payment rows) and is a one-way ratchet on updates: the import can close a project but never
// reopens one that was closed in-app.
export const import_projects = async (
	connection: Connection,
	context: ArbostarImportContext,
	{ leads, estimates, workorders, invoices, line_items, declines, taxes }: {
		leads: ArbostarLead[]
		estimates: ArbostarEstimate[]
		workorders: ArbostarWorkOrder[]
		invoices: ArbostarInvoice[]
		line_items: ArbostarLineItem[]
		declines: ArbostarDecline[]
		taxes: ArbostarTax[]
	},
	imported_clients: ImportedClients,
): Promise<ImportedProjects> => {
	const { client_id_by_arbostar_client_id, primary_address_by_arbostar_client_id } = imported_clients
	const estimates_by_lead_id = group_by(filter(estimates, estimate => estimate.lead_id !== null), estimate => estimate.lead_id!)
	const workorders_by_lead_id = group_by(filter(workorders, workorder => workorder.lead_id !== null), workorder => workorder.lead_id!)
	const invoices_by_lead_id = group_by(filter(invoices, invoice => invoice.lead_id !== null), invoice => invoice.lead_id!)
	const line_items_by_lead_id = group_by(line_items, item => item.lead_id)
	const decline_by_estimate_id = new Map(map(declines, decline => [decline.estimate_id, decline] as const))

	const importable = filter(leads, lead => lead.client_id !== null && client_id_by_arbostar_client_id.has(lead.client_id))

	// Raise the company's allocator above every number ArboStar has issued — before any
	// project writes, so an in-app lead created mid-import gets a number that can't collide
	// with the ones being inserted. All leads count (a lead skipped for having no client
	// still burned its number in ArboStar), and the 1000 gap covers ArboStar issuing new
	// numbers between this export and the next while both systems run. GREATEST so a
	// re-import never moves the allocator backwards past numbers already handed out in-app.
	const lead_numbers = map(filter(leads, lead => lead.lead_no !== null), lead_number)
	const max_arbostar_number = lead_numbers.length === 0 ? null : lead_numbers.reduce((a, b) => (b > a ? b : a))
	if (max_arbostar_number !== null) {
		await connection.query(
			'UPDATE project_number SET next_number = GREATEST(next_number, ?) WHERE company_id = ?',
			[max_arbostar_number + 1000n, context.company_id],
		)
	}

	// Each lead's official tax entry (null = not taxable), resolved up front so the needed
	// tax_rate rows can be created in one batch before the project rows reference them. A
	// lead whose invoices charged no tax is not taxable; one that charged any tax cannot be
	// on a 0% rate, so it snaps among the nonzero official rates — the invoice-total
	// fallback in implied_tax_ratio can blend the rate down (even to exactly halfway
	// between 0% and the real rate), and 0% must not win.
	const nonzero_official_taxes = filter(official_tax_list(taxes), entry => entry.ratio.gt('0'))
	const official_tax_by_lead_id = new Map<number, OfficialTax | null>(map(importable, lead => {
		const implied = implied_tax_ratio(
			invoices_by_lead_id.get(lead.lead_id) ?? [],
			line_items_by_lead_id.get(lead.lead_id) ?? [],
		)
		return [lead.lead_id, implied === 0 ? null : nearest_official_tax(nonzero_official_taxes, implied)] as const
	}))

	const needed_taxes = new Map<string, OfficialTax>()
	for (const entry of official_tax_by_lead_id.values()) {
		if (entry !== null) needed_taxes.set(entry.name, entry)
	}

	const tax_rate_row_by_name = new Map<string, { tax_rate_id: bigint; tax_rate: FinancialNumber }>()
	const new_tax_rates: OfficialTax[] = []
	for (const entry of needed_taxes.values()) {
		const existing = context.existing.tax_rate_by_name.get(normalize_name(entry.name))
		if (existing === undefined) new_tax_rates.push(entry)
		else {
			assert(
				entry.ratio.equal(existing.tax_rate),
				`existing tax rate "${entry.name}" (${existing.tax_rate}) carries the ArboStar rate ${entry.ratio.toString()}`,
			)
			tax_rate_row_by_name.set(entry.name, { tax_rate_id: existing.tax_rate_id, tax_rate: entry.ratio })
		}
	}
	if (new_tax_rates.length > 0) {
		const { insert_ids } = await write_helper.bulk_insert(
			connection,
			'tax_rate',
			map(new_tax_rates, entry => ({
				company_id: context.company_id,
				name: entry.name,
				tax_rate: entry.ratio,
			})),
			ROWS_PER_BATCH,
		)
		new_tax_rates.forEach((entry, index) =>
			tax_rate_row_by_name.set(entry.name, { tax_rate_id: insert_ids[index]!, tax_rate: entry.ratio }))
	}

	const project_tax = (lead: ArbostarLead): ProjectTax => {
		const entry = official_tax_by_lead_id.get(lead.lead_id) ?? null
		if (entry === null) return NOT_TAXABLE
		const row = tax_rate_row_by_name.get(entry.name)
		assert(row, `tax rate "${entry.name}" has a row`)
		return { taxable: true, ...row }
	}

	// The ArboStar-derived columns — everything an update overwrites.
	const project_fields = (lead: ArbostarLead) => {
		const lead_estimates = estimates_by_lead_id.get(lead.lead_id) ?? []
		const lead_workorders = workorders_by_lead_id.get(lead.lead_id) ?? []
		const lead_invoices = invoices_by_lead_id.get(lead.lead_id) ?? []
		const address = primary_address_by_arbostar_client_id.get(lead.client_id!)!

		const documents = context.project_document_ids
		// Dead at the estimate stage means every estimate is Declined/Expired/Thinking. An
		// active client "no" (at least one Declined estimate) lands on the Declined Proposal
		// document; all-dead with no Declined (Expired/Thinking only) stays on the Proposal
		// document, keeping silence distinguishable from a decline.
		const all_estimates_dead = lead_estimates.length > 0 && every(
			lead_estimates,
			estimate => estimate.status_id !== null && ARBOSTAR_ESTIMATE_STATUSES_DEAD.includes(estimate.status_id),
		)
		const declined_estimates = filter(lead_estimates, estimate => estimate.status_id === ARBOSTAR_ESTIMATE_STATUS_DECLINED)
		const project_document_id =
			lead_workorders.length > 0 || lead_invoices.length > 0 ? documents.work_order
			: lead.lead_status_id === ARBOSTAR_LEAD_STATUS_NO_GO ? documents.void
			: lead_estimates.length > 0
				? (all_estimates_dead && declined_estimates.length > 0 ? documents.declined_proposal : documents.estimate)
			: lead.lead_status_id === ARBOSTAR_LEAD_STATUS_NEW || lead.lead_status_id === ARBOSTAR_LEAD_STATUS_DRAFT
				? documents.lead_unqualified
				: documents.lead_qualified

		// Work completed, or the deal is dead: No Go leads (Void), declined proposals, and
		// leads whose every estimate Expired / went Thinking have no more work to do. Dying
		// before the Work Order document doesn't count as a sale — only that document has
		// represents_billable_sale_when_closed.
		const closed = some(lead_workorders, workorder => workorder.status === ARBOSTAR_WO_STATUS_FINISHED)
			|| lead_invoices.length > 0
			|| project_document_id === documents.void
			|| project_document_id === documents.declined_proposal
			|| (project_document_id === documents.estimate && all_estimates_dead)

		// The most recently created declined estimate's reason, mapped onto the company's
		// seeded reasons. Only projects dying on Declined Proposal carry a reason, so a
		// decline that was later superseded (the lead went on to a work order) doesn't leave
		// a stale reason behind.
		const latest_decline = declined_estimates.reduce<ArbostarDecline | null>((latest, estimate) => {
			const decline = decline_by_estimate_id.get(estimate.estimate_id)
			if (decline === undefined) return latest
			if (latest === null) return decline
			return (decline.date_created_unix ?? 0) > (latest.date_created_unix ?? 0)
				|| ((decline.date_created_unix ?? 0) === (latest.date_created_unix ?? 0) && decline.estimate_id > latest.estimate_id)
				? decline
				: latest
		}, null)
		const mapped_seed_reason = latest_decline?.reason_name == null
			? undefined
			: SEED_DECLINE_REASON_BY_ARBOSTAR_REASON.get(normalize_name(latest_decline.reason_name))
		const project_decline_reason_id = project_document_id === documents.declined_proposal && mapped_seed_reason !== undefined
			? context.decline_reason_id_by_reason.get(mapped_seed_reason) ?? null
			: null

		// Invoice totals are authoritative when they exist (they carry the real discounts and
		// tax, which line items can't reproduce). Otherwise the subtotal is the non-declined
		// line sum — ArboStar's own current-state math (its work order total_price equals
		// exactly that; its estimate total_price is a stale snapshot that usually still counts
		// declined lines) — with no tax, since only invoices carry a tax amount to imply a
		// rate from. A lead with no lines has no quote yet: all three stay null.
		const lead_lines = line_items_by_lead_id.get(lead.lead_id) ?? []
		const totals = lead_invoices.length > 0
			? {
				subtotal: money(lead_invoices.reduce((sum, invoice) => sum + (invoice.total_for_services ?? 0), 0)),
				tax_total: money(lead_invoices.reduce((sum, invoice) => sum + (invoice.tax ?? 0), 0)),
				total: money(lead_invoices.reduce((sum, invoice) => sum + (invoice.total_including_tax ?? 0), 0)),
			}
			: lead_lines.length === 0
				? { subtotal: null, tax_total: null, total: null }
				: (() => {
					const subtotal = money(
						filter(lead_lines, line => line.status !== 'Declined')
							.reduce((sum, line) => sum + (line.price ?? 0) * (line.quantity ?? 1), 0),
					)
					return { subtotal, tax_total: money(0), total: subtotal }
				})()

		const estimator_name = string_or_null(lead.estimator)
			?? map(lead_estimates, estimate => string_or_null(estimate.estimator)).find(name => name !== null)
			?? map(lead_workorders, workorder => string_or_null(workorder.estimator)).find(name => name !== null)
			?? null
		const assigned_estimator_employee_id = estimator_name === null
			? null
			: context.employee_id_by_name.get(normalize_name(estimator_name)) ?? null

		const lead_details = join_lines([
			lead.lead_no === null ? null : `ArboStar lead ${lead.lead_no}`,
			lead.lead_status_name === null ? null : `Status: ${lead.lead_status_name}`,
			lead.lead_priority === null ? null : `Priority: ${lead.lead_priority}`,
			lead.lead_date_created === null
				? null
				: `Created ${lead.lead_date_created}${lead.lead_created_by === null ? '' : ` by ${lead.lead_created_by}`}`,
			assigned_estimator_employee_id === null && estimator_name !== null ? `Estimator: ${estimator_name}` : null,
			(lead.lead_address ?? lead.address_line_display) === null
				? null
				: `Lead address: ${lead.lead_address ?? lead.address_line_display}`,
			...map(lead_estimates, estimate => describe_estimate(estimate, decline_by_estimate_id.get(estimate.estimate_id))),
			...map(lead_workorders, describe_workorder),
			...map(lead_invoices, describe_invoice),
		])

		const notes_for_office = join_lines([
			...map(lead_workorders, workorder => workorder.office_notes),
			...map(lead_invoices, invoice => invoice.invoice_notes),
		])

		return {
			project_document_id,
			client_id: client_id_by_arbostar_client_id.get(lead.client_id!)!,
			client_address_id: address.client_address_id,
			address_line_1: address.address_line_1,
			address_line_2: address.address_line_2,
			city: address.city,
			state: address.state,
			zip: address.zip,
			contact_name: address.contact_name,
			contact_phone: address.contact_phone,
			contact_email: address.contact_email,
			assigned_estimator_employee_id,
			lead_details,
			needs_client_approval: project_document_id === documents.estimate,
			sent_for_client_approval: some(
				lead_estimates,
				estimate => estimate.email_status !== null
					|| (estimate.status_id !== null && ARBOSTAR_ESTIMATE_STATUSES_SENT.includes(estimate.status_id)),
			),
			notes_for_office,
			closed,
			project_decline_reason_id,
			lead_source: lead.utm_source ?? '',
			...totals,
			...project_tax(lead),
		}
	}

	const existing_leads = filter(importable, lead => context.existing.project_id_by_number.has(Number(lead_number(lead))))
	const new_leads = filter(importable, lead => !context.existing.project_id_by_number.has(Number(lead_number(lead))))

	// A lead that is no longer closing must not reopen a project, so still-open rows leave
	// the closed column alone.
	const existing_rows = map(existing_leads, lead => {
		const { closed, ...set } = project_fields(lead)
		return {
			key: context.existing.project_id_by_number.get(Number(lead_number(lead)))!,
			set: closed ? { closed, ...set } : set,
		}
	})
	await write_helper.bulk_update(connection, 'project', 'project_id', existing_rows, ROWS_PER_BATCH)
	const project_id_by_arbostar_lead_id = new Map(map(
		existing_leads,
		lead => [lead.lead_id, context.existing.project_id_by_number.get(Number(lead_number(lead)))!] as const,
	))

	if (new_leads.length > 0) {
		const project_rows = map(new_leads, lead => ({
			company_id: context.company_id,
			number: lead_number(lead),
			...project_fields(lead),
			due_date: null,
			emergency: false,
			created_by_employee_id: context.created_by_employee_id,
			notes_for_crew: '',
			closed_at: null,
			closed_date: null,
		}))
		const { insert_ids } = await write_helper.bulk_insert(connection, 'project', project_rows, ROWS_PER_BATCH)
		new_leads.forEach((lead, index) => project_id_by_arbostar_lead_id.set(lead.lead_id, insert_ids[index]!))
	}

	// Only numbers within ArboStar's issued range can be missing-from-export — anything above
	// max_arbostar_number is an in-app allocation, not a deleted lead. A pre-import in-app
	// project with a low number could still land in this count, so treat it as a flag to
	// investigate, not an exact deletion count.
	const incoming_numbers = new Set(map(leads, lead => (lead.lead_no === null ? null : Number(lead_number(lead)))))
	const no_longer_in_export = filter(
		[...context.existing.project_id_by_number.keys()],
		number => number <= Number(max_arbostar_number ?? 0n) && !incoming_numbers.has(number),
	).length

	return {
		project_id_by_arbostar_lead_id,
		counts: {
			tax_rates_inserted: new_tax_rates.length,
			projects_inserted: new_leads.length,
			projects_updated: existing_leads.length,
			projects_no_longer_in_export: no_longer_in_export,
			skipped_leads_without_client: leads.length - importable.length,
		},
	}
}
