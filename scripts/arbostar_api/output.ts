import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const output_dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'arbostar_api_export')

export const write_output = (name: string, rows: readonly unknown[]): string => {
	mkdirSync(output_dir, { recursive: true })
	const path = join(output_dir, `${name}.js`)
	writeFileSync(path, `export default ${JSON.stringify(rows, null, '\t')}\n`)
	return path
}
