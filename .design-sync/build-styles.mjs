// Off-script style builder for the treebzns CSS-only design system.
// Concatenates the repo's stylesheet closure into one self-contained
// ds-bundle/styles.css, inlining the 98-icon SVGs the CSS url()-references as
// data URIs so the rendered-design @import closure needs no external assets.
//
// Run from repo root:  node .design-sync/build-styles.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const repo = process.cwd()
const pub = join(repo, 'public')
const out = join(repo, 'ds-bundle')
mkdirSync(out, { recursive: true })

// Stylesheet load order matches public/app.html (minus build/index.css, the
// compiled Svelte component styles, which aren't part of the design system).
const ORDER = ['global_reset.css', 'global_variables.css', 'global_styles.css', '98.css']

function svgDataUri(file) {
	const svg = readFileSync(join(pub, '98-icon', file), 'utf8')
	// Compact, URL-encode the bits that break inside a CSS url("...").
	const encoded = svg
		.replace(/\s*\n\s*/g, ' ')
		.replace(/"/g, "'")
		.replace(/#/g, '%23')
		.replace(/</g, '%3C')
		.replace(/>/g, '%3E')
		.trim()
	return `url("data:image/svg+xml,${encoded}")`
}

let css = `/* treebzns design system — combined stylesheet closure.
 * Built by .design-sync/build-styles.mjs from public/{global_reset,global_variables,global_styles}.css + public/98.css.
 * 98-icon SVGs are inlined as data URIs so this file is fully self-contained. */\n`

for (const name of ORDER) {
	let part = readFileSync(join(pub, name), 'utf8')
	part = part.replace(/url\("\.\/98-icon\/([^"]+)"\)/g, (_, file) => svgDataUri(file))
	css += `\n/* ===== ${name} ===== */\n${part}\n`
}

writeFileSync(join(out, 'styles.css'), css)
console.log(`wrote ${join(out, 'styles.css')} (${css.length} bytes)`)
