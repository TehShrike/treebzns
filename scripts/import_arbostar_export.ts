// Imports the gitignored arbostar_export/ data into the current schema for one company.
// Run with the same env vars as the other db scripts (MYSQL_* plus SPACES_* for the photos):
// dotenv -- node scripts/import_arbostar_export.ts --company_id 1
// This file is only the node-side glue (env vars, CLI args, data files, photo bytes, console
// output) — the import itself lives in #shared/arbostar/import_arbostar_export.ts.
import { parseArgs } from 'node:util'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from '#shared/assert.ts'
import { create_pool, require_mysql_env } from '#shared/mysql/connection.ts'
import { create_spaces_client, require_spaces_env } from '#shared/s3/spaces.ts'
import import_arbostar_export from '#shared/arbostar/import_arbostar_export.ts'
import { leads_to_download_images_for } from './arbostar/leads_to_download_images_for.ts'
import { make_read_arbostar_image_file_from_disk } from './arbostar/image_files.ts'
import clients from '#arbostar_export/clients.js'
import leads from '#arbostar_export/leads.js'
import estimates from '#arbostar_export/estimates.js'
import invoices from '#arbostar_export/invoices.js'
import workorders from '#arbostar_export/workorders.js'
import line_items from '#arbostar_export/line_items.js'
import lead_notes from '#arbostar_export/lead_notes.js'
import declines from '#arbostar_export/declines.js'
import payments from '#arbostar_export/payments.js'
import users from '#arbostar_export/users.js'
import taxes from '#arbostar_export/taxes.js'
import crew_roles from '#arbostar_export/crew_roles.js'
import images from '#arbostar_export/images.js'

const { values: args } = parseArgs({ options: { company_id: { type: 'string' } } })
assert(
	args.company_id !== undefined && /^\d+$/.test(args.company_id),
	'Usage: node scripts/import_arbostar_export.ts --company_id <id>',
)
const company_id = BigInt(args.company_id)

const EXPORT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'arbostar_export')
const THUMBNAILS_DIR = join(EXPORT_DIR, 'images', 'thumbnails')

// The app's pool factory, so the import runs with exactly the same connection options
// (rowsAsArray, bigint/Temporal/FinancialNumber typecasting, timezone) as the worker.
const pool = create_pool(require_mysql_env(process.env))
const s3 = create_spaces_client(require_spaces_env(process.env))

try {
	const summary = await import_arbostar_export({
		pool,
		company_id,
		data: {
			clients,
			leads,
			estimates,
			invoices,
			workorders,
			line_items,
			lead_notes,
			declines,
			payments,
			users,
			taxes,
			crew_roles,
			images,
		},
		s3,
		read_arbostar_image_file_from_disk: make_read_arbostar_image_file_from_disk({ export_dir: EXPORT_DIR, thumbnails_dir: THUMBNAILS_DIR }),
		// Photos are exported for the leads with current work only, so photo deletes are scoped
		// to the same set. Computed at import time, the 30-day cutoff can only be later than the
		// export's, so the set can shrink but never grow past what the export covered.
		lead_ids_to_download_images_for: new Set(leads_to_download_images_for(estimates, workorders, new Date()).lead_ids),
		log: message => console.log(message),
	})

	console.log(`Imported ArboStar export into company ${company_id}:`)
	for (const [key, value] of Object.entries(summary)) {
		console.log(`  ${key}: ${value}`)
	}
} finally {
	await pool.end()
}
