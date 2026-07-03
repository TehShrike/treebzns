import type { Connection } from 'mysql2/promise'
import type { Client } from '#arbostar_export/clients.d.ts'
import type { Contact } from '#arbostar_export/contacts.d.ts'
import type { ClientAddress as ArbostarClientAddress } from '#arbostar_export/addresses.d.ts'
import type { Lead } from '#arbostar_export/leads.d.ts'
import type { Estimate } from '#arbostar_export/estimates.d.ts'
import type { Invoice } from '#arbostar_export/invoices.d.ts'
import type { WorkOrder } from '#arbostar_export/workorders.d.ts'
import type { LineItem } from '#arbostar_export/line_items.d.ts'
import type { User } from '#arbostar_export/users.d.ts'
import type { InsertableSchema } from '#schema/types.ts'
import * as schema from '#schema/all_table_column_names.ts'
import * as insertable_schema from '#schema/insertable_table_column_names.ts'
import typed_insert_helper from '#shared/sql_request/typed_insert_helper.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import fnum from '#shared/number.ts'
import { map, filter, flatten, chunk } from '#shared/array.ts'

const insert_helper = typed_insert_helper<InsertableSchema>(schema, insertable_schema)

export const ROWS_PER_BATCH = 1000

export type ArbostarExportData = {
	clients: Client[]
	contacts: Contact[]
	addresses: ArbostarClientAddress[]
	leads: Lead[]
	estimates: Estimate[]
	invoices: Invoice[]
	workorders: WorkOrder[]
	line_items: LineItem[]
	users: User[]
}

export type ArbostarImportContext = {
	company_id: bigint
	// Imported projects are attributed to this employee (project.created_by_employee_id).
	created_by_employee_id: bigint
	// Resolved from the global project_document codebook by name.
	project_document_ids: {
		lead_unqualified: bigint
		lead_qualified: bigint
		estimate: bigint
		work_order: bigint
		void: bigint
	}
	// Normalized employee name (see normalize_name) → employee_id, for the company's existing
	// employees. import_employees folds the imported ArboStar users into this map before it's
	// used to match estimator names.
	employee_id_by_name: Map<string, bigint>
	// Lowercased emails already used by the company's existing employees — employee has a unique
	// (company_id, email) key, so imported users must not reuse them.
	existing_employee_emails: Set<string>
}

export const normalize_name = (name: string): string => name.trim().toLowerCase()

type ImportedPrimaryAddress = {
	client_address_id: bigint
	address_line_1: string
	address_line_2: string
	city: string
	state: string
	zip: string
}

export type ImportedClients = {
	client_id_by_arbostar_client_id: Map<number, bigint>
	primary_address_by_arbostar_client_id: Map<number, ImportedPrimaryAddress>
	counts: {
		clients: number
		client_addresses: number
		client_contacts: number
		skipped_contacts_without_client: number
	}
}

const group_by = <T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> => {
	const groups = new Map<K, T[]>()
	for (const item of items) {
		const k = key(item)
		const group = groups.get(k)
		if (group) group.push(item)
		else groups.set(k, [item])
	}
	return groups
}

const join_lines = (parts: Array<string | null | undefined>): string =>
	filter(map(parts, part => part ?? ''), part => part !== '').join('\n')

const money = (value: number) => fnum(value.toFixed(2))
const money_display = (value: number | null): string | null => (value === null ? null : `$${value.toFixed(2)}`)

// ArboStar's contacts carry both a raw and a display-formatted phone; prefer the formatted one.
const contact_phone = (contact: Contact): string | null => contact.cc_phone_view ?? contact.cc_phone

// The export types say estimator is string | null, but ArboStar actually returns [] for some
// leads and work orders with no estimator — treat any non-string as missing.
const string_or_null = (value: string | null): string | null => (typeof value === 'string' ? value : null)

// ArboStar's client_type is a numeric code; the June 2026 export contains only these two, and the
// type-2 client list is unmistakably businesses/HOAs/churches. An unknown code stays as-is.
const client_type_label = (client_type: string): string =>
	client_type === '1' ? 'Residential'
	: client_type === '2' ? 'Commercial'
	: client_type

export type ImportedEmployees = {
	employee_id_by_arbostar_user_id: Map<number, bigint>
	// context.employee_id_by_name plus the imported users, so downstream estimator-name matching
	// resolves to imported employees as well as pre-existing ones.
	employee_id_by_name: Map<string, bigint>
	counts: {
		employees: number
		matched_existing_employees: number
	}
}

// users.js → employee. A user whose name already matches an existing employee (normalized) is
// not inserted again — the existing employee id is used for correlation instead.
export const import_employees = async (
	connection: Connection,
	context: ArbostarImportContext,
	users: User[],
): Promise<ImportedEmployees> => {
	const employee_id_by_name = new Map(context.employee_id_by_name)
	const taken_emails = new Set(context.existing_employee_emails)

	const matched: Array<readonly [number, bigint]> = []
	const new_users: User[] = []
	for (const user of users) {
		const existing_employee_id = employee_id_by_name.get(normalize_name(user.full_name))
		if (existing_employee_id === undefined) new_users.push(user)
		else matched.push([user.user_id, existing_employee_id])
	}

	// employee.email is unique per company, but the ArboStar accounts reuse and omit emails —
	// fall from login email to personal email to a synthesized placeholder.
	const pick_email = (user: User): string => {
		for (const candidate of [user.user_email, user.personal_email]) {
			if (candidate !== '' && !taken_emails.has(candidate.toLowerCase())) return candidate
		}
		return `arbostar.user.${user.user_id}@import.invalid`
	}

	const employee_rows = map(new_users, user => {
		const email = pick_email(user)
		taken_emails.add(email.toLowerCase())
		return {
			company_id: context.company_id,
			name: user.full_name,
			email,
			phone: user.emp_phone,
			// An empty hash can never equal a computed PBKDF2 hex digest, so imported employees
			// cannot log in until someone sets a real password for them.
			password_hash: '',
			is_owner: false,
			number_of_password_hash_iterations: 50_000n, // the app's DEFAULT_NUMBER_OF_PASSWORD_HASH_ITERATIONS
		}
	})

	const employee_id_by_arbostar_user_id = new Map(matched)
	if (employee_rows.length > 0) {
		const { insert_ids } = await insert_helper.bulk_insert(connection, 'employee', employee_rows, ROWS_PER_BATCH)
		new_users.forEach((user, index) => {
			employee_id_by_arbostar_user_id.set(user.user_id, insert_ids[index]!)
			const normalized = normalize_name(user.full_name)
			if (!employee_id_by_name.has(normalized)) employee_id_by_name.set(normalized, insert_ids[index]!)
		})
	}

	return {
		employee_id_by_arbostar_user_id,
		employee_id_by_name,
		counts: {
			employees: employee_rows.length,
			matched_existing_employees: matched.length,
		},
	}
}

// clients.js + contacts.js + addresses.js → client, client_address, client_contact.
// client and client_address reference each other, so clients are inserted with a placeholder
// primary_client_address_id (there are no FK constraints) and fixed up once addresses exist —
// the same populate-after-insert convention the schema documents.
export const import_clients = async (
	connection: Connection,
	context: ArbostarImportContext,
	{ clients, contacts, addresses }: Pick<ArbostarExportData, 'clients' | 'contacts' | 'addresses'>,
): Promise<ImportedClients> => {
	const contacts_by_client_id = group_by(contacts, contact => contact.client_id)

	const client_rows = map(clients, client => {
		const client_contacts = contacts_by_client_id.get(client.client_id) ?? []
		const first_phone = map(client_contacts, contact_phone).find(phone => phone !== null) ?? null
		const first_email = map(client_contacts, contact => contact.cc_email).find(email => email !== null) ?? null

		return {
			company_id: context.company_id,
			name: client.client_name ?? `ArboStar client ${client.client_id}`,
			primary_client_address_id: 0n, // fixed up below once the address rows exist
			billing_client_address_id: null,
			primary_phone: first_phone ?? '',
			primary_email: first_email ?? '',
			tax_rate_id: null,
			notes: join_lines([
				client.client_type === null ? null : `ArboStar client type: ${client_type_label(client.client_type)}`,
				// client_date_created is already YYYY-MM-DD; the slice guards against a future
				// export switching to full timestamps.
				client.client_date_created === null ? null : `Created in ArboStar: ${client.client_date_created.slice(0, 10)}`,
			]),
			referred_by: '',
		}
	})
	const { insert_ids: client_ids } = await insert_helper.bulk_insert(connection, 'client', client_rows, ROWS_PER_BATCH)
	const client_id_by_arbostar_client_id = new Map(map(clients, (client, index) => [client.client_id, client_ids[index]!] as const))

	// The primary address comes from the client row itself: addresses.js has no second address line
	// and is missing a few clients, while every client row carries its primary address columns.
	const primary_address_rows = map(clients, (client, index) => ({
		company_id: context.company_id,
		client_id: client_ids[index]!,
		name: 'Primary',
		address_line_1: client.client_address ?? '',
		address_line_2: client.client_address2 ?? '',
		city: client.client_city ?? '',
		state: client.client_state ?? '',
		zip: client.client_zip ?? '',
		contact: '',
		phone: '',
		email: '',
	}))
	const secondary_addresses = filter(
		addresses,
		address => address.address_type === 'secondary' && client_id_by_arbostar_client_id.has(address.client_id),
	)
	const secondary_address_rows = map(secondary_addresses, address => ({
		company_id: context.company_id,
		client_id: client_id_by_arbostar_client_id.get(address.client_id)!,
		name: 'Secondary',
		address_line_1: address.address ?? '',
		address_line_2: '',
		city: address.city ?? '',
		state: address.state ?? '',
		zip: address.zip ?? '',
		contact: '',
		phone: '',
		email: '',
	}))
	// Primaries first so address ids stay index-aligned with `clients`.
	const { insert_ids: address_ids } = await insert_helper.bulk_insert(
		connection,
		'client_address',
		[...primary_address_rows, ...secondary_address_rows],
		ROWS_PER_BATCH,
	)

	const fix_ups = map(clients, (_client, index) => ({
		client_id: client_ids[index]!,
		client_address_id: address_ids[index]!,
	}))
	for (const batch of chunk(fix_ups, ROWS_PER_BATCH)) {
		const cases = map(
			batch,
			({ client_id, client_address_id }) => `WHEN ${escape_value(client_id)} THEN ${escape_value(client_address_id)}`,
		).join(' ')
		const id_list = map(batch, ({ client_id }) => escape_value(client_id)).join(', ')
		await connection.query(
			`UPDATE client SET primary_client_address_id = CASE client_id ${cases} END`
			+ ` WHERE company_id = ${escape_value(context.company_id)} AND client_id IN (${id_list})`,
		)
	}

	const primary_address_by_arbostar_client_id = new Map(map(clients, (client, index) => [
		client.client_id,
		{
			client_address_id: address_ids[index]!,
			address_line_1: primary_address_rows[index]!.address_line_1,
			address_line_2: primary_address_rows[index]!.address_line_2,
			city: primary_address_rows[index]!.city,
			state: primary_address_rows[index]!.state,
			zip: primary_address_rows[index]!.zip,
		},
	] as const))

	const contact_rows = flatten(map(clients, client => {
		const client_contacts = contacts_by_client_id.get(client.client_id) ?? []
		return map(client_contacts, (contact, index) => ({
			company_id: context.company_id,
			client_id: client_id_by_arbostar_client_id.get(client.client_id)!,
			contact_name: join_lines([contact.cc_title, contact.cc_name]).replace('\n', ' ') || `ArboStar contact ${contact.cc_id}`,
			phone: contact_phone(contact),
			email: contact.cc_email,
			// ArboStar doesn't flag a primary contact; treat each client's first one as primary.
			is_primary: index === 0,
			sort_order: BigInt(index),
		}))
	}))
	if (contact_rows.length > 0) {
		await insert_helper.bulk_insert(connection, 'client_contact', contact_rows, ROWS_PER_BATCH)
	}

	return {
		client_id_by_arbostar_client_id,
		primary_address_by_arbostar_client_id,
		counts: {
			clients: client_rows.length,
			client_addresses: primary_address_rows.length + secondary_address_rows.length,
			client_contacts: contact_rows.length,
			skipped_contacts_without_client: contacts.length - contact_rows.length,
		},
	}
}

export type ImportedProjects = {
	project_id_by_arbostar_lead_id: Map<number, bigint>
	counts: {
		projects: number
		skipped_leads_without_client: number
	}
}

const describe_estimate = (estimate: Estimate): string =>
	join_lines([
		`Estimate ${estimate.estimate_no ?? estimate.estimate_id}`
		+ (estimate.status_name === null ? '' : ` (${estimate.status_name})`)
		+ (estimate.total_price === null ? '' : `: ${money_display(estimate.total_price)}`),
	])

const describe_workorder = (workorder: WorkOrder): string =>
	`Work order ${workorder.workorder_no ?? workorder.workorder_id}`
	+ (workorder.status === null ? '' : ` (${workorder.status})`)
	+ (workorder.total_price === null ? '' : `: ${money_display(workorder.total_price)}`)

const describe_invoice = (invoice: Invoice): string =>
	`Invoice ${invoice.invoice_no ?? invoice.invoice_id}`
	+ (invoice.total_including_tax === null ? '' : `: ${money_display(invoice.total_including_tax)}`)
	+ (invoice.amount_paid === null ? '' : `, paid ${money_display(invoice.amount_paid)}`)

// ArboStar lead statuses (see scripts/arbostar/readme.md): 1 New · 3 No Go · 4 Estimated · 5 Draft.
const ARBOSTAR_LEAD_STATUS_NO_GO = 3
const ARBOSTAR_LEAD_STATUS_NEW = 1
const ARBOSTAR_LEAD_STATUS_DRAFT = 5
// ArboStar estimate statuses: 2 Sent for approval · 3 Pending approval.
const ARBOSTAR_ESTIMATE_STATUSES_SENT = [2, 3]
// ArboStar work order status 7: Finished by field worker.
const ARBOSTAR_WO_STATUS_FINISHED = 7

// One project per ArboStar lead — this schema models the whole lead → estimate → work order
// pipeline as a single project moving between project documents, so the related estimates,
// work orders, and invoices choose the document stage and are summarized into lead_details.
export const import_projects = async (
	connection: Connection,
	context: ArbostarImportContext,
	{ leads, estimates, workorders, invoices }: Pick<ArbostarExportData, 'leads' | 'estimates' | 'workorders' | 'invoices'>,
	imported_clients: ImportedClients,
): Promise<ImportedProjects> => {
	const { client_id_by_arbostar_client_id, primary_address_by_arbostar_client_id } = imported_clients
	const estimates_by_lead_id = group_by(filter(estimates, estimate => estimate.lead_id !== null), estimate => estimate.lead_id!)
	const workorders_by_lead_id = group_by(filter(workorders, workorder => workorder.lead_id !== null), workorder => workorder.lead_id!)
	const invoices_by_lead_id = group_by(filter(invoices, invoice => invoice.lead_id !== null), invoice => invoice.lead_id!)

	const importable = filter(leads, lead => lead.client_id !== null && client_id_by_arbostar_client_id.has(lead.client_id))

	const project_rows = map(importable, lead => {
		const lead_estimates = estimates_by_lead_id.get(lead.lead_id) ?? []
		const lead_workorders = workorders_by_lead_id.get(lead.lead_id) ?? []
		const lead_invoices = invoices_by_lead_id.get(lead.lead_id) ?? []
		const address = primary_address_by_arbostar_client_id.get(lead.client_id!)!

		const documents = context.project_document_ids
		const project_document_id =
			lead_workorders.length > 0 || lead_invoices.length > 0 ? documents.work_order
			: lead.lead_status_id === ARBOSTAR_LEAD_STATUS_NO_GO ? documents.void
			: lead_estimates.length > 0 ? documents.estimate
			: lead.lead_status_id === ARBOSTAR_LEAD_STATUS_NEW || lead.lead_status_id === ARBOSTAR_LEAD_STATUS_DRAFT
				? documents.lead_unqualified
				: documents.lead_qualified

		const closed = lead_workorders.some(workorder => workorder.wo_status_id === ARBOSTAR_WO_STATUS_FINISHED)
			|| (lead_invoices.length > 0 && lead_invoices.every(invoice => (invoice.total_due ?? 0) <= 0))

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
			...map(lead_estimates, describe_estimate),
			...map(lead_workorders, describe_workorder),
			...map(lead_invoices, describe_invoice),
		])

		const notes_for_office = join_lines([
			...map(lead_workorders, workorder => workorder.office_notes),
			...map(lead_invoices, invoice => invoice.invoice_notes),
		])

		return {
			company_id: context.company_id,
			project_document_id,
			client_id: client_id_by_arbostar_client_id.get(lead.client_id!)!,
			client_address_id: address.client_address_id,
			address_line_1: address.address_line_1,
			address_line_2: address.address_line_2,
			city: address.city,
			state: address.state,
			zip: address.zip,
			due_date: null,
			emergency: false,
			assigned_estimator_employee_id,
			lead_details: lead_details === '' ? null : lead_details,
			created_by_employee_id: context.created_by_employee_id,
			needs_client_approval: project_document_id === documents.estimate,
			sent_for_client_approval: lead_estimates.some(
				estimate => estimate.status_id !== null && ARBOSTAR_ESTIMATE_STATUSES_SENT.includes(estimate.status_id),
			),
			tax_rate_id: null,
			tax_rate: null,
			notes_for_crew: null,
			notes_for_office: notes_for_office === '' ? null : notes_for_office,
			closed,
			closed_at: null,
			closed_date: null,
			lead_source: lead.utm_source,
		}
	})

	const project_id_by_arbostar_lead_id = new Map<number, bigint>()
	if (project_rows.length > 0) {
		const { insert_ids } = await insert_helper.bulk_insert(connection, 'project', project_rows, ROWS_PER_BATCH)
		importable.forEach((lead, index) => project_id_by_arbostar_lead_id.set(lead.lead_id, insert_ids[index]!))
	}

	return {
		project_id_by_arbostar_lead_id,
		counts: {
			projects: project_rows.length,
			skipped_leads_without_client: leads.length - importable.length,
		},
	}
}

export type ImportedLineItems = {
	counts: {
		item_types: number
		project_line_items: number
		skipped_line_items_without_project: number
	}
}

// line_items.js → item_type + project_line_item. Distinct service names become item types.
export const import_line_items = async (
	connection: Connection,
	context: ArbostarImportContext,
	line_items: LineItem[],
	project_id_by_arbostar_lead_id: Map<number, bigint>,
): Promise<ImportedLineItems> => {
	const importable = filter(line_items, item => project_id_by_arbostar_lead_id.has(item.lead_id))

	const taxable_by_service_name = new Map<string, boolean>()
	for (const item of importable) {
		if (item.service_name !== null && !taxable_by_service_name.has(item.service_name)) {
			taxable_by_service_name.set(item.service_name, !item.non_taxable)
		}
	}
	const service_names = [...taxable_by_service_name.keys()]

	const item_type_id_by_name = new Map<string, bigint>()
	if (service_names.length > 0) {
		const item_type_rows = map(service_names, name => ({
			company_id: context.company_id,
			name,
			taxable: taxable_by_service_name.get(name)!,
		}))
		const { insert_ids } = await insert_helper.bulk_insert(connection, 'item_type', item_type_rows, ROWS_PER_BATCH)
		service_names.forEach((name, index) => item_type_id_by_name.set(name, insert_ids[index]!))
	}

	if (importable.length > 0) {
		const line_item_rows = map(importable, item => {
			const description = join_lines([
				item.description,
				item.size === null ? null : `Size: ${item.size}`,
				item.species === null ? null : `Species: ${item.species}`,
				item.reason === null ? null : `Reason: ${item.reason}`,
			])
			return {
				company_id: context.company_id,
				project_id: project_id_by_arbostar_lead_id.get(item.lead_id)!,
				description: description === '' ? null : description,
				item_type_id: item.service_name === null ? null : item_type_id_by_name.get(item.service_name)!,
				estimated_hours: BigInt(Math.round(item.man_hours ?? 0)),
				taxable: !item.non_taxable,
				quantity: money(item.quantity ?? 1),
				price: money(item.price ?? 0),
			}
		})
		await insert_helper.bulk_insert(connection, 'project_line_item', line_item_rows, ROWS_PER_BATCH)
	}

	return {
		counts: {
			item_types: service_names.length,
			project_line_items: importable.length,
			skipped_line_items_without_project: line_items.length - importable.length,
		},
	}
}

export type ImportedPayments = {
	counts: {
		payments: number
		payment_projects: number
	}
}

// Invoices with a paid amount become payment rows (this schema has no invoice entity — the
// project itself represents the billable document), applied to the lead's project when known.
export const import_payments = async (
	connection: Connection,
	context: ArbostarImportContext,
	invoices: Invoice[],
	imported_clients: ImportedClients,
	project_id_by_arbostar_lead_id: Map<number, bigint>,
): Promise<ImportedPayments> => {
	const { client_id_by_arbostar_client_id } = imported_clients
	const paid_invoices = filter(
		invoices,
		invoice => (invoice.amount_paid ?? 0) > 0
			&& invoice.client_id !== null
			&& client_id_by_arbostar_client_id.has(invoice.client_id),
	)
	if (paid_invoices.length === 0) return { counts: { payments: 0, payment_projects: 0 } }

	const payment_rows = map(paid_invoices, invoice => ({
		company_id: context.company_id,
		client_id: client_id_by_arbostar_client_id.get(invoice.client_id!)!,
		amount: money(invoice.amount_paid!),
		payment_method: 'arbostar import',
		status: 'completed',
	}))
	const { insert_ids: payment_ids } = await insert_helper.bulk_insert(connection, 'payment', payment_rows, ROWS_PER_BATCH)

	const payment_project_rows = flatten(map(paid_invoices, (invoice, index) => {
		const project_id = invoice.lead_id === null ? undefined : project_id_by_arbostar_lead_id.get(invoice.lead_id)
		if (project_id === undefined) return []
		return [{
			company_id: context.company_id,
			payment_id: payment_ids[index]!,
			project_id,
			amount: money(invoice.amount_paid!),
		}]
	}))
	if (payment_project_rows.length > 0) {
		await insert_helper.bulk_insert(connection, 'payment_project', payment_project_rows, ROWS_PER_BATCH)
	}

	return {
		counts: {
			payments: payment_rows.length,
			payment_projects: payment_project_rows.length,
		},
	}
}

const import_arbostar_export = async (
	connection: Connection,
	context: ArbostarImportContext,
	data: ArbostarExportData,
) => {
	// Employees first: the enriched name map lets project estimator names resolve to the
	// imported users, not just pre-existing employees.
	const imported_employees = await import_employees(connection, context, data.users)
	const context_with_employees: ArbostarImportContext = {
		...context,
		employee_id_by_name: imported_employees.employee_id_by_name,
	}

	const imported_clients = await import_clients(connection, context_with_employees, data)
	const imported_projects = await import_projects(connection, context_with_employees, data, imported_clients)
	const imported_line_items = await import_line_items(
		connection,
		context_with_employees,
		data.line_items,
		imported_projects.project_id_by_arbostar_lead_id,
	)
	const imported_payments = await import_payments(
		connection,
		context_with_employees,
		data.invoices,
		imported_clients,
		imported_projects.project_id_by_arbostar_lead_id,
	)

	return {
		...imported_employees.counts,
		...imported_clients.counts,
		...imported_projects.counts,
		...imported_line_items.counts,
		...imported_payments.counts,
	}
}

export default import_arbostar_export
