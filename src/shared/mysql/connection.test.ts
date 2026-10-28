import { test } from 'node:test'
import * as assert from 'node:assert'
import { static_connection_options, type Field } from './connection.ts'

const type_cast = static_connection_options.typeCast
assert.ok(typeof type_cast === 'function', `the static connection options define a typeCast function`)

const json_field = (value: string | null): Field => ({
	type: `JSON`,
	length: 0,
	db: ``,
	table: ``,
	name: `strokes`,
	string: (encoding?: BufferEncoding | string) => {
		assert.strictEqual(encoding, `utf8`, `JSON columns are decoded as utf8`)
		return value
	},
	buffer: () => null,
})

const next = () => {
	throw new Error(`typeCast must handle JSON fields itself`)
}

test('typeCast: parses JSON columns into their underlying value', () => {
	assert.deepStrictEqual(type_cast(json_field(`[{"points":[{"x":1,"y":2}],"color":"#d40000","line_width":4.5}]`) as any, next), [
		{ points: [{ x: 1, y: 2 }], color: `#d40000`, line_width: 4.5 },
	])
	assert.deepStrictEqual(type_cast(json_field(`{"blocked":true}`) as any, next), { blocked: true })
})

test('typeCast: a NULL JSON column reads as null', () => {
	assert.strictEqual(type_cast(json_field(null) as any, next), null)
})
