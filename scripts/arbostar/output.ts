// Shared I/O for the ArboStar export scripts. All exports land in <repo-root>/arbostar_export/
// as ESM modules (`export default <data>`), regardless of the current working directory. The
// .js data files are gitignored (they hold client PII); the sibling .d.ts files are committed
// and type them.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'arbostar_export')

/** Write `rows` to arbostar_export/<filename> (a .js) as `export default <rows>`. */
export function write_output(filename: string, rows: unknown): string {
	mkdirSync(OUTPUT_DIR, { recursive: true })
	const path = join(OUTPUT_DIR, filename)
	writeFileSync(path, `export default ${JSON.stringify(rows, null, '\t')}\n`)
	return path
}

/** Read a previously-written arbostar_export/<filename> — its default export. */
export async function read_output<T = unknown>(filename: string): Promise<T> {
	try {
		const module = (await import(pathToFileURL(join(OUTPUT_DIR, filename)).href)) as { default: T }
		return module.default
	} catch {
		throw new Error(`Missing/invalid arbostar_export/${filename} — run its export script first.`)
	}
}
