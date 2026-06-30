// Shared output writer for the ArboStar export scripts. All exports land in
// <repo-root>/arbostar_export/ (gitignored) regardless of the current working directory.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'arbostar_export')

/** Write `rows` as pretty JSON to arbostar_export/<filename> and return the full path. */
export function write_output(filename: string, rows: unknown): string {
	mkdirSync(OUTPUT_DIR, { recursive: true })
	const path = join(OUTPUT_DIR, filename)
	writeFileSync(path, JSON.stringify(rows, null, '\t') + '\n')
	return path
}

/** Read a previously-written arbostar_export/<filename> back as JSON. */
export function read_output<T = unknown>(filename: string): T {
	try {
		return JSON.parse(readFileSync(join(OUTPUT_DIR, filename), 'utf8')) as T
	} catch {
		throw new Error(`Missing arbostar_export/${filename} — run its export script first.`)
	}
}
