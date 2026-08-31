// Run-now export: runs every export_*.ts script in this directory.
//
//   node scripts/arbostar/export_all.ts
//
// Independent scripts run in parallel. export_line_items.ts and export_work_types.ts
// read estimates.js, so they start after export_estimates.ts finishes. Each child's
// output is prefixed with its dataset name.

import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { map, filter } from '#shared/array.ts'

const script_dir = dirname(fileURLToPath(import.meta.url))

const INDEPENDENT = [
	'export_clients.ts',
	'export_leads.ts',
	'export_invoices.ts',
	'export_workorders.ts',
	'export_payments.ts',
	'export_users.ts',
	'export_taxes.ts',
	'export_declines.ts',
	'export_tree_inventory.ts',
]
const READS_ESTIMATES = ['export_line_items.ts', 'export_work_types.ts']

type Result = { script: string; ok: boolean }

const format_duration = (ms: number): string => {
	const seconds = Math.round(ms / 1000)
	return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

const run = async (script: string): Promise<Result> => {
	const label = script.replace(/^export_|\.ts$/g, '')
	const started = Date.now()
	const child = spawn(process.execPath, [join(script_dir, script)], {
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	const prefix_lines = (stream: NodeJS.ReadableStream, out: NodeJS.WritableStream) =>
		createInterface({ input: stream }).on('line', line => out.write(`[${label}] ${line}\n`))
	prefix_lines(child.stdout!, process.stdout)
	prefix_lines(child.stderr!, process.stderr)
	const [code] = (await once(child, 'close')) as [number | null]
	const ok = code === 0
	console.log(`[${label}] ${ok ? 'finished' : 'failed'} in ${format_duration(Date.now() - started)}`)
	return { script, ok }
}

const run_estimates_then_dependents = async (): Promise<Result[]> => {
	const estimates = await run('export_estimates.ts')
	if (!estimates.ok) {
		console.error(`export_estimates.ts failed — skipping ${READS_ESTIMATES.join(', ')}`)
		return [estimates, ...map(READS_ESTIMATES, script => ({ script, ok: false }))]
	}
	return [estimates, ...(await Promise.all(map(READS_ESTIMATES, run)))]
}

const results = (
	await Promise.all([run_estimates_then_dependents(), ...map(INDEPENDENT, run)])
).flat()

const failed = filter(results, result => !result.ok)
if (failed.length > 0) {
	console.error(`Failed: ${map(failed, result => result.script).join(', ')}`)
	process.exit(1)
}
console.log(`All ${results.length} exports finished.`)
