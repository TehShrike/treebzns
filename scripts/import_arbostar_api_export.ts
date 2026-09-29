// pnpm run arbostar:api_export schedule_events
// pnpm exec dotenv -- node scripts/import_arbostar_api_export.ts --company_id <id>
// Run scripts/import_arbostar_export.ts first: this import matches projects, line items, and employees that it created.
import { parseArgs } from 'node:util'
import assert from '#shared/assert.ts'
import { for_each } from '#shared/array.ts'
import { create_pool, require_mysql_env } from '#shared/mysql/connection.ts'
import { import_schedule_events } from '#shared/arbostar/import_schedule_events.ts'
import schedule_events from '#arbostar_api_export/schedule_events.js'

const { values: args } = parseArgs({ options: { company_id: { type: 'string' } } })
assert(
	args.company_id !== undefined && /^\d+$/.test(args.company_id),
	'Usage: node scripts/import_arbostar_api_export.ts --company_id <id>',
)
const company_id = BigInt(args.company_id)

const pool = create_pool(require_mysql_env(process.env))

try {
	const summary = await import_schedule_events(pool, company_id, schedule_events)
	console.log(`Imported ArboStar API export into company ${company_id}:`)
	for_each(Object.entries(summary), ([key, value]) => console.log(`  ${key}: ${value}`))
} finally {
	await pool.end()
}
