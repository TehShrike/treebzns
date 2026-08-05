// Bulk-loads a company's existing ArboStar → local correlations (the arbostar_* columns from
// migration 0016 plus the natural keys) so the importers can decide update-vs-insert in
// memory. On a company's first import every map is empty.
import type { Connection, Pool } from 'mysql2/promise'
import { map, filter } from '#shared/array.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import { run_select, normalize_name } from './import_common.ts'
import type { Schema } from '#schema/types.ts'

export type ExistingCorrelations = {
	employee_id_by_arbostar_user_id: Map<number, bigint>
	client_id_by_arbostar_client_id: Map<number, bigint>
	primary_client_address_id_by_arbostar_client_id: Map<number, bigint>
	project_id_by_number: Map<number, bigint>
	payment_id_by_arbostar_payment_id: Map<number, bigint>
	client_contact_id_by_arbostar_contact_id: Map<number, bigint>
	project_line_item_id_by_arbostar_line_item_id: Map<number, bigint>
	// Keyed by normalize_name(name), matching the case-insensitive unique keys on
	// (company_id, name).
	item_type_id_by_name: Map<string, bigint>
	payment_method_id_by_name: Map<string, bigint>
	// Also keyed by normalize_name(name) — work_skill has no unique key on name, but the
	// import treats the (derived) name as the natural key.
	work_skill_id_by_name: Map<string, bigint>
	// The rate is kept as its DECIMAL(6,4) string ("0.0550") so importers can check that a
	// name-matched row still carries the expected rate.
	tax_rate_by_name: Map<string, { tax_rate_id: bigint; tax_rate: string }>
}

// BigInt()/Number() rather than trusting the schema types: the worker connection typecasts
// INTs to bigint, but plain script connections return them as numbers.
const correlation_map = <Row>(
	rows: Row[],
	arbostar_id: (row: Row) => bigint | number | null,
	local_id: (row: Row) => bigint | number,
): Map<number, bigint> =>
	new Map(map(
		filter(rows, row => arbostar_id(row) !== null),
		row => [Number(arbostar_id(row)), BigInt(local_id(row))] as const,
	))

export const load_existing_correlations = async (
	connection: Connection | Pool,
	company_id: bigint,
): Promise<ExistingCorrelations> => {
	const employee_query = query_builder<Schema>()
		.from('employee')
		.where(b => b.comparison('employee.company_id', '=', { value: company_id }))
		.select(() => ['employee.employee_id', 'employee.arbostar_user_id'])
		.build()
	const client_query = query_builder<Schema>()
		.from('client')
		.where(b => b.comparison('client.company_id', '=', { value: company_id }))
		.select(() => ['client.client_id', 'client.arbostar_client_id', 'client.primary_client_address_id'])
		.build()
	const project_query = query_builder<Schema>()
		.from('project')
		.where(b => b.comparison('project.company_id', '=', { value: company_id }))
		.select(() => ['project.project_id', 'project.number'])
		.build()
	const payment_query = query_builder<Schema>()
		.from('payment')
		.where(b => b.comparison('payment.company_id', '=', { value: company_id }))
		.select(() => ['payment.payment_id', 'payment.arbostar_payment_id'])
		.build()
	const contact_query = query_builder<Schema>()
		.from('client_contact')
		.where(b => b.comparison('client_contact.company_id', '=', { value: company_id }))
		.select(() => ['client_contact.client_contact_id', 'client_contact.arbostar_contact_id'])
		.build()
	const line_item_query = query_builder<Schema>()
		.from('project_line_item')
		.where(b => b.comparison('project_line_item.company_id', '=', { value: company_id }))
		.select(() => ['project_line_item.project_line_item_id', 'project_line_item.arbostar_line_item_id'])
		.build()
	const item_type_query = query_builder<Schema>()
		.from('item_type')
		.where(b => b.comparison('item_type.company_id', '=', { value: company_id }))
		.select(() => ['item_type.item_type_id', 'item_type.name'])
		.build()
	const payment_method_query = query_builder<Schema>()
		.from('payment_method')
		.where(b => b.comparison('payment_method.company_id', '=', { value: company_id }))
		.select(() => ['payment_method.payment_method_id', 'payment_method.name'])
		.build()
	const tax_rate_query = query_builder<Schema>()
		.from('tax_rate')
		.where(b => b.comparison('tax_rate.company_id', '=', { value: company_id }))
		.select(() => ['tax_rate.tax_rate_id', 'tax_rate.name', 'tax_rate.tax_rate'])
		.build()
	const work_skill_query = query_builder<Schema>()
		.from('work_skill')
		.where(b => b.comparison('work_skill.company_id', '=', { value: company_id }))
		.select(() => ['work_skill.work_skill_id', 'work_skill.name'])
		.build()

	const [employees, clients, projects, payments, contacts, line_items, item_types, payment_methods, tax_rates, work_skills] = await Promise.all([
		run_select(connection, employee_query),
		run_select(connection, client_query),
		run_select(connection, project_query),
		run_select(connection, payment_query),
		run_select(connection, contact_query),
		run_select(connection, line_item_query),
		run_select(connection, item_type_query),
		run_select(connection, payment_method_query),
		run_select(connection, tax_rate_query),
		run_select(connection, work_skill_query),
	])

	return {
		employee_id_by_arbostar_user_id: correlation_map(
			employees,
			row => row.employee.arbostar_user_id,
			row => row.employee.employee_id,
		),
		client_id_by_arbostar_client_id: correlation_map(
			clients,
			row => row.client.arbostar_client_id,
			row => row.client.client_id,
		),
		primary_client_address_id_by_arbostar_client_id: correlation_map(
			clients,
			row => row.client.arbostar_client_id,
			row => row.client.primary_client_address_id,
		),
		project_id_by_number: correlation_map(
			projects,
			row => row.project.number,
			row => row.project.project_id,
		),
		payment_id_by_arbostar_payment_id: correlation_map(
			payments,
			row => row.payment.arbostar_payment_id,
			row => row.payment.payment_id,
		),
		client_contact_id_by_arbostar_contact_id: correlation_map(
			contacts,
			row => row.client_contact.arbostar_contact_id,
			row => row.client_contact.client_contact_id,
		),
		project_line_item_id_by_arbostar_line_item_id: correlation_map(
			line_items,
			row => row.project_line_item.arbostar_line_item_id,
			row => row.project_line_item.project_line_item_id,
		),
		item_type_id_by_name: new Map(map(
			item_types,
			row => [normalize_name(row.item_type.name), BigInt(row.item_type.item_type_id)] as const,
		)),
		payment_method_id_by_name: new Map(map(
			payment_methods,
			row => [normalize_name(row.payment_method.name), BigInt(row.payment_method.payment_method_id)] as const,
		)),
		tax_rate_by_name: new Map(map(
			tax_rates,
			row => [
				normalize_name(row.tax_rate.name),
				{ tax_rate_id: BigInt(row.tax_rate.tax_rate_id), tax_rate: String(row.tax_rate.tax_rate) },
			] as const,
		)),
		work_skill_id_by_name: new Map(map(
			work_skills,
			row => [normalize_name(row.work_skill.name), BigInt(row.work_skill.work_skill_id)] as const,
		)),
	}
}
