// Imports the gitignored arbostar_export/ data into the current schema for one company.
// Run with the same env vars as the other db scripts: dotenv -- node scripts/import_arbostar_export.ts --company_id 1
import { createConnection } from 'mysql2/promise'
import type { Connection, RowDataPacket } from 'mysql2/promise'
import { parseArgs } from 'node:util'
import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import { make_safe_query_builder } from '#shared/sql_request/safe_sql_query.ts'
import * as schema from '#schema/all_table_column_names.ts'
import type { Schema } from '#schema/types.ts'
import import_arbostar_export, { normalize_name } from '#shared/arbostar/import_arbostar_export.ts'
import type { ArbostarImportContext } from '#shared/arbostar/import_arbostar_export.ts'
import clients from '#arbostar_export/clients.js'
import contacts from '#arbostar_export/contacts.js'
import addresses from '#arbostar_export/addresses.js'
import leads from '#arbostar_export/leads.js'
import estimates from '#arbostar_export/estimates.js'
import invoices from '#arbostar_export/invoices.js'
import workorders from '#arbostar_export/workorders.js'
import line_items from '#arbostar_export/line_items.js'

function requireEnv(key: string): string {
	const val = process.env[key]
	if (val === undefined) throw new Error(`Missing env var: ${key}`)
	return val
}

const { values: args } = parseArgs({ options: { company_id: { type: 'string' } } })
assert(
	args.company_id !== undefined && /^\d+$/.test(args.company_id),
	'Usage: node scripts/import_arbostar_export.ts --company_id <id>',
)
const company_id = BigInt(args.company_id)

const { to_sql } = make_safe_query_builder(schema)

const run_select = async <Row>(
	connection: Connection,
	built: { query: Parameters<typeof to_sql>[0]; positional_row_to_named: (row: unknown[]) => Row },
): Promise<Row[]> => {
	const { sql, values } = to_sql(built.query)
	const [rows] = await connection.query<RowDataPacket[]>({ sql, values, rowsAsArray: true })
	return map(rows as unknown as unknown[][], row => built.positional_row_to_named(row))
}

const resolve_context = async (connection: Connection): Promise<ArbostarImportContext> => {
	const company_query = query_builder<Schema>()
		.from('company')
		.where(b => b.comparison('company.company_id', '=', { value: company_id }))
		.select(() => ['company.company_id'])
		.build()
	const company_rows = await run_select(connection, company_query)
	assert(company_rows.length === 1, `Company ${company_id} does not exist`)

	const employee_query = query_builder<Schema>()
		.from('employee')
		.where(b => b.comparison('employee.company_id', '=', { value: company_id }))
		.order_by('employee.is_owner', 'DESC')
		.select(() => ['employee.employee_id', 'employee.name'])
		.build()
	const employee_rows = await run_select(connection, employee_query)
	assert(employee_rows.length > 0, `Company ${company_id} has no employees — imported projects need a created_by employee`)

	const document_query = query_builder<Schema>()
		.from('project_document')
		.select(() => ['project_document.project_document_id', 'project_document.name'])
		.build()
	const document_rows = await run_select(connection, document_query)
	const document_id_by_name = new Map(map(
		document_rows,
		row => [row.project_document.name, BigInt(row.project_document.project_document_id)] as const,
	))
	const document_id = (name: string): bigint => {
		const id = document_id_by_name.get(name)
		assert(id !== undefined, `Missing project document "${name}" — run migrations first`)
		return id
	}

	return {
		company_id,
		created_by_employee_id: BigInt(employee_rows[0]!.employee.employee_id),
		project_document_ids: {
			lead_unqualified: document_id('Lead (Unqualified)'),
			lead_qualified: document_id('Lead (Qualified)'),
			estimate: document_id('Estimate'),
			work_order: document_id('Work Order'),
			void: document_id('Void'),
		},
		employee_id_by_name: new Map(map(
			employee_rows,
			row => [normalize_name(row.employee.name), BigInt(row.employee.employee_id)] as const,
		)),
	}
}

const connection = await createConnection({
	host: requireEnv('MYSQL_HOST'),
	port: Number(requireEnv('MYSQL_PORT')),
	user: requireEnv('MYSQL_USER'),
	password: requireEnv('MYSQL_PASS'),
	database: requireEnv('MYSQL_DB'),
	// In prod, MYSQL_CA_CERT (base64-encoded PEM) is set, which makes TLS required and
	// verifies the server against the CA. Unset locally, so the connection is plaintext.
	...(process.env.MYSQL_CA_CERT
		? { ssl: { ca: Buffer.from(process.env.MYSQL_CA_CERT, 'base64').toString('utf8') } }
		: {}),
})

try {
	const context = await resolve_context(connection)

	await connection.beginTransaction()
	try {
		const summary = await import_arbostar_export(connection, context, {
			clients,
			contacts,
			addresses,
			leads,
			estimates,
			invoices,
			workorders,
			line_items,
		})
		await connection.commit()

		console.log(`Imported ArboStar export into company ${company_id}:`)
		for (const [key, value] of Object.entries(summary)) {
			console.log(`  ${key}: ${value}`)
		}
	} catch (error) {
		await connection.rollback()
		throw error
	}
} finally {
	await connection.end()
}
