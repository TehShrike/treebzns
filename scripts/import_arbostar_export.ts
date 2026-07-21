// Imports the gitignored arbostar_export/ data into the current schema for one company.
// Run with the same env vars as the other db scripts: dotenv -- node scripts/import_arbostar_export.ts --company_id 1
// This file is only the node-side glue (env vars, CLI args, data files, console output) —
// the import itself lives in #shared/arbostar/import_arbostar_export.ts.
import { parseArgs } from 'node:util'
import assert from '#shared/assert.ts'
import { create_pool } from '#worker/lib/mysql/connection.ts'
import import_arbostar_export from '#shared/arbostar/import_arbostar_export.ts'
import clients from '#arbostar_export/clients.js'
import leads from '#arbostar_export/leads.js'
import estimates from '#arbostar_export/estimates.js'
import invoices from '#arbostar_export/invoices.js'
import workorders from '#arbostar_export/workorders.js'
import line_items from '#arbostar_export/line_items.js'
import payments from '#arbostar_export/payments.js'
import users from '#arbostar_export/users.js'
import taxes from '#arbostar_export/taxes.js'

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

// The app's pool factory, so the import runs with exactly the same connection options
// (rowsAsArray, bigint/Temporal/FinancialNumber typecasting, timezone) as the worker.
const pool = create_pool({
	MYSQL_HOST: requireEnv('MYSQL_HOST'),
	MYSQL_PORT: requireEnv('MYSQL_PORT'),
	MYSQL_USER: requireEnv('MYSQL_USER'),
	MYSQL_PASS: requireEnv('MYSQL_PASS'),
	MYSQL_DB: requireEnv('MYSQL_DB'),
	...(process.env.MYSQL_CA_CERT ? { MYSQL_CA_CERT: process.env.MYSQL_CA_CERT } : {}),
})

try {
	const summary = await import_arbostar_export(pool, company_id, {
		clients,
		leads,
		estimates,
		invoices,
		workorders,
		line_items,
		payments,
		users,
		taxes,
	})

	console.log(`Imported ArboStar export into company ${company_id}:`)
	for (const [key, value] of Object.entries(summary)) {
		console.log(`  ${key}: ${value}`)
	}
} finally {
	await pool.end()
}
