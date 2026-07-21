// Run-now export: pulls the company's official tax list and writes arbostar_export/taxes.js.
//
//   node scripts/arbostar/export_taxes.ts
//
// Taxes have no JSON endpoint — the /settings page embeds the full list as a hidden
// <input id="allTaxes"> whose (HTML-entity-encoded) value is the same JSON the tax
// dropdowns consume elsewhere in the app.
//
// Auth comes from ./session.ts; the output shape is declared in arbostar_export/taxes.d.ts.

import assert from '#shared/assert.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import type { ArbostarTax } from '#arbostar_export/taxes.d.ts'

const response = await fetch(`${BASE_URL}/settings`, {
	headers: {
		accept: 'text/html',
		...AUTH_HEADERS,
	},
})
assert(response.ok, `GET /settings responds ok — got ${response.status}`)
const html = await response.text()

const input_tag = /<input[^>]*id="allTaxes"[^>]*>/.exec(html)?.[0]
assert(input_tag, 'the /settings page contains the #allTaxes hidden input')
const encoded_value = /value='([^']*)'/.exec(input_tag)?.[1]
assert(encoded_value !== undefined, 'the #allTaxes input has a value attribute')

const decode_entities = (value: string): string =>
	value.replaceAll('&quot;', '"').replaceAll('&#039;', "'").replaceAll('&amp;', '&')

const raw_taxes = JSON.parse(decode_entities(encoded_value)) as Array<Record<string, unknown>>
assert(Array.isArray(raw_taxes) && raw_taxes.length > 0, 'the #allTaxes value holds a non-empty array')

const taxes = raw_taxes.map((tax): ExportShape<ArbostarTax> => ({
	id: tax.id,
	text: tax.text,
	name: tax.name,
	rate: tax.rate,
	value: tax.value,
	edit: tax.edit,
}))

const path = write_output('taxes.js', taxes)
console.log(`Wrote ${taxes.length} taxes to ${path}`)
