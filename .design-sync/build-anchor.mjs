// Off-script anchor builder. Writes ds-bundle/_ds_sync.json with content hashes
// of the source inputs and emitted outputs so a future re-sync can detect what
// changed. This is a hand-produced anchor (the converter's storybook/package
// recipe does not apply to a CSS-only DS), so a re-sync should still re-verify
// the cards visually — see NOTES.md.
//
// Run from repo root, last (after build-styles.mjs + build-components.mjs):
//   node .design-sync/build-anchor.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'

const repo = process.cwd()
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16)

function walk(dir, acc = []) {
	for (const e of readdirSync(dir)) {
		const p = join(dir, e)
		if (e.startsWith('.')) continue
		statSync(p).isDirectory() ? walk(p, acc) : acc.push(p)
	}
	return acc
}

const inputs = [
	'public/global_reset.css',
	'public/global_variables.css',
	'public/global_styles.css',
	'public/98.css',
	'client/route/design_system/DesignSystem.State.svelte',
	'.design-sync/build-styles.mjs',
	'.design-sync/build-components.mjs',
]
const sourceHashes = {}
for (const f of inputs) sourceHashes[f] = sha(join(repo, f))

const bundle = join(repo, 'ds-bundle')
const renderHashes = {}
for (const f of walk(bundle).sort()) {
	renderHashes[relative(bundle, f)] = sha(f)
}

const anchor = {
	shape: 'css-only',
	offScript: true,
	globalName: 'Treebzns98',
	note: 'Hand-produced anchor for a CSS-only design system (no React bundle). Re-sync re-runs the .design-sync/build-*.mjs scripts and re-verifies cards visually.',
	styleSha: renderHashes['styles.css'],
	bundleSha12: renderHashes['_ds_bundle.js'],
	sourceHashes,
	renderHashes,
}
writeFileSync(join(bundle, '_ds_sync.json'), JSON.stringify(anchor, null, '\t') + '\n')
console.log(`wrote ds-bundle/_ds_sync.json (${Object.keys(renderHashes).length} output files)`)
