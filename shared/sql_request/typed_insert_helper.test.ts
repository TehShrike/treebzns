import { test } from 'node:test'
import * as assert from 'node:assert'
import type { Connection } from 'mysql2/promise'
import { Temporal } from '@js-temporal/polyfill'
import type { FinancialNumber } from 'financial-number'
import fnum from '#shared/number.ts'
import typed_insert_helper from './typed_insert_helper.ts'

type TestSchema = {
	widget: {
		company_id: bigint
		name: string
		description: string | null
	}
	gadget: {
		company_id: bigint
		widget_id: bigint
		quantity: bigint
	}
}

// The full column-name map (every column, e.g. all_table_column_names): includes the
// auto-increment id and created_at that are not part of TestSchema's insertable set.
const test_schema = {
	widget: {
		widget_id: 'widget_id',
		company_id: 'company_id',
		name: 'name',
		description: 'description',
		created_at: 'created_at',
	},
	gadget: {
		gadget_id: 'gadget_id',
		company_id: 'company_id',
		widget_id: 'widget_id',
		quantity: 'quantity',
		created_at: 'created_at',
	},
} as const

// The insertable-only column-name map (insertable_table_column_names): exactly the columns
// bulk_insert writes for every row.
const test_insertable_schema = {
	widget: {
		company_id: 'company_id',
		name: 'name',
		description: 'description',
	},
	gadget: {
		company_id: 'company_id',
		widget_id: 'widget_id',
		quantity: 'quantity',
	},
} as const

// insert_ids lets a test control the insertId reported for each successive query (a real multi-row
// INSERT reports the first id of the statement's consecutive block).
const make_mock_connection = (insert_ids: number[] = []) => {
	const calls: Array<{ sql: string }> = []
	const connection = {
		query: (sql: string) => {
			const insertId = insert_ids[calls.length] ?? 1
			calls.push({ sql })
			return Promise.resolve([{ insertId }, []])
		},
	} as unknown as Connection
	return { connection, calls }
}

test('typed_insert_helper: schema constants must cover every insertable table and column', () => {
	// test_schema includes all of TestSchema's tables/columns (plus extras), so this is allowed.
	typed_insert_helper<TestSchema>(test_schema, test_insertable_schema)

	const missing_name = {
		widget: {
			widget_id: 'widget_id',
			company_id: 'company_id',
			description: 'description',
			created_at: 'created_at',
		},
		gadget: test_schema.gadget,
	} as const
	// @ts-expect-error: widget is missing the required 'name' column
	typed_insert_helper<TestSchema>(missing_name, test_insertable_schema)

	const widget_only = {
		widget: test_schema.widget,
	} as const
	// @ts-expect-error: missing the entire 'gadget' table
	typed_insert_helper<TestSchema>(widget_only, test_insertable_schema)
})

test('typed_insert_helper: the insertable column-name map must also cover every insertable column', () => {
	const insertable_missing_name = {
		widget: {
			company_id: 'company_id',
			description: 'description',
		},
		gadget: test_insertable_schema.gadget,
	} as const
	// @ts-expect-error: the insertable column-name map is missing the required 'name' column
	typed_insert_helper<TestSchema>(test_schema, insertable_missing_name)

	const insertable_widget_only = {
		widget: test_insertable_schema.widget,
	} as const
	// @ts-expect-error: the insertable column-name map is missing the entire 'gadget' table
	typed_insert_helper<TestSchema>(test_schema, insertable_widget_only)
})

test('typed_insert_helper: insert enforces column names and value types', async () => {
	const { connection } = make_mock_connection()
	const helper = typed_insert_helper<TestSchema>(test_schema, test_insertable_schema)

	helper.insert(connection, 'widget', { company_id: 1n, name: 'Sprocket', description: null })
	helper.insert(connection, 'widget', { company_id: 1n, name: 'Sprocket', description: 'a description' })
	helper.insert(connection, 'gadget', { company_id: 1n, widget_id: 2n, quantity: 3n })

	// @ts-expect-error: company_id must be a bigint
	helper.insert(connection, 'widget', { company_id: 'not a bigint', name: 'x', description: null })

	// @ts-expect-error: 'name' is a required column
	helper.insert(connection, 'widget', { company_id: 1n, description: null })

	await assert.rejects(async () => {
		// @ts-expect-error: 'sprockets' is not a column on widget
		await helper.insert(connection, 'widget', { company_id: 1n, name: 'x', description: null, sprockets: 1n })
	})

	await assert.rejects(async () => {
		// @ts-expect-error: 'not_a_table' is not a table in TestSchema
		await helper.insert(connection, 'not_a_table', {})
	})
})

test('typed_insert_helper: insert builds an INSERT statement with escaped values inlined', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = typed_insert_helper<TestSchema>(test_schema, test_insertable_schema)

	await helper.insert(connection, 'widget', { company_id: 7n, name: 'Sprocket', description: null })

	assert.strictEqual(calls.length, 1)
	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (7, 'Sprocket', NULL)",
	)
})

test('typed_insert_helper: insert escapes string values against injection', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = typed_insert_helper<TestSchema>(test_schema, test_insertable_schema)

	await helper.insert(connection, 'widget', { company_id: 7n, name: "O'Sprocket'); DROP TABLE widget; --", description: null })

	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (7, 'O\\'Sprocket\\'); DROP TABLE widget; --', NULL)",
	)
})

test('typed_insert_helper: serializes Temporal and FinancialNumber values for the driver', async () => {
	type EventSchema = {
		event: {
			company_id: bigint
			happens_on: Temporal.PlainDate | null
			price: FinancialNumber
		}
	}
	const event_schema = {
		event: {
			event_id: 'event_id',
			company_id: 'company_id',
			happens_on: 'happens_on',
			price: 'price',
			created_at: 'created_at',
		},
	} as const
	const event_insertable_schema = {
		event: {
			company_id: 'company_id',
			happens_on: 'happens_on',
			price: 'price',
		},
	} as const

	const { connection, calls } = make_mock_connection()
	const helper = typed_insert_helper<EventSchema>(event_schema, event_insertable_schema)

	await helper.insert(connection, 'event', {
		company_id: 1n,
		happens_on: Temporal.PlainDate.from('2026-06-15'),
		price: fnum('12.34'),
	})

	// bigint renders as a numeric literal; Temporal.PlainDate and FinancialNumber become quoted MySQL strings.
	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `event` (`company_id`, `happens_on`, `price`) VALUES (1, '2026-06-15', '12.34')",
	)
})

test('typed_insert_helper: nullable columns may be omitted; non-nullable columns are required', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = typed_insert_helper<TestSchema>(test_schema, test_insertable_schema)

	// description is `string | null`, so it can be left out entirely.
	await helper.insert(connection, 'widget', { company_id: 1n, name: 'Sprocket' })
	assert.strictEqual(calls[0]!.sql, "INSERT INTO `widget` (`company_id`, `name`) VALUES (1, 'Sprocket')")

	// @ts-expect-error: 'name' is not nullable, so it still must be provided
	helper.insert(connection, 'widget', { company_id: 1n })
})

test('typed_insert_helper: bulk_insert enforces row types, column names, and an array of rows', async () => {
	const { connection } = make_mock_connection()
	const helper = typed_insert_helper<TestSchema>(test_schema, test_insertable_schema)

	helper.bulk_insert(connection, 'widget', [
		{ company_id: 1n, name: 'Sprocket', description: null },
		{ company_id: 2n, name: 'Cog', description: 'geared' },
	], 1000)
	// description is nullable, so it may be omitted from a row.
	helper.bulk_insert(connection, 'widget', [{ company_id: 1n, name: 'Sprocket' }], 1000)
	helper.bulk_insert(connection, 'gadget', [{ company_id: 1n, widget_id: 2n, quantity: 3n }], 1000)

	// @ts-expect-error: company_id must be a bigint
	helper.bulk_insert(connection, 'widget', [{ company_id: 'not a bigint', name: 'x', description: null }], 1000)

	// @ts-expect-error: 'name' is a required column
	helper.bulk_insert(connection, 'widget', [{ company_id: 1n, description: null }], 1000)

	// @ts-expect-error: 'sprockets' is not a column on widget (only insertable columns are written,
	// so at runtime an unknown key is simply ignored — the error here is purely at the type level).
	helper.bulk_insert(connection, 'widget', [{ company_id: 1n, name: 'x', description: null, sprockets: 1n }], 1000)

	await assert.rejects(async () => {
		// @ts-expect-error: rows must be an array, not a single row object
		await helper.bulk_insert(connection, 'widget', { company_id: 1n, name: 'x', description: null }, 1000)
	})

	await assert.rejects(async () => {
		// @ts-expect-error: 'not_a_table' is not a table in TestSchema
		await helper.bulk_insert(connection, 'not_a_table', [{}], 1000)
	})
})

test('typed_insert_helper: bulk_insert writes every insertable column for every row, null for missing', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = typed_insert_helper<TestSchema>(test_schema, test_insertable_schema)

	await helper.bulk_insert(connection, 'widget', [
		{ company_id: 7n, name: 'Sprocket', description: 'first' },
		// description omitted -> inserted as null; the column list stays identical.
		{ company_id: 8n, name: 'Cog' },
	], 1000)

	assert.strictEqual(calls.length, 1)
	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (7, 'Sprocket', 'first'), (8, 'Cog', NULL)",
	)
})

test('typed_insert_helper: bulk_insert serializes Temporal and FinancialNumber values', async () => {
	type EventSchema = {
		event: {
			company_id: bigint
			happens_on: Temporal.PlainDate | null
			price: FinancialNumber
		}
	}
	const event_schema = {
		event: {
			event_id: 'event_id',
			company_id: 'company_id',
			happens_on: 'happens_on',
			price: 'price',
			created_at: 'created_at',
		},
	} as const
	const event_insertable_schema = {
		event: {
			company_id: 'company_id',
			happens_on: 'happens_on',
			price: 'price',
		},
	} as const

	const { connection, calls } = make_mock_connection()
	const helper = typed_insert_helper<EventSchema>(event_schema, event_insertable_schema)

	await helper.bulk_insert(connection, 'event', [
		{ company_id: 1n, happens_on: Temporal.PlainDate.from('2026-06-15'), price: fnum('12.34') },
		// happens_on omitted -> null; price still serialized to a string.
		{ company_id: 2n, price: fnum('56.78') },
	], 1000)

	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `event` (`company_id`, `happens_on`, `price`) VALUES (1, '2026-06-15', '12.34'), (2, NULL, '56.78')",
	)
})

test('typed_insert_helper: bulk_insert rejects an empty rows array', async () => {
	const { connection } = make_mock_connection()
	const helper = typed_insert_helper<TestSchema>(test_schema, test_insertable_schema)

	await assert.rejects(async () => {
		await helper.bulk_insert(connection, 'widget', [], 1000)
	})
})

test('typed_insert_helper: bulk_insert splits rows into batches of rows_per_batch', async () => {
	// Each query reports the first insert id of its batch, as MySQL does.
	const { connection, calls } = make_mock_connection([10, 20, 30])
	const helper = typed_insert_helper<TestSchema>(test_schema, test_insertable_schema)

	const rows = [1n, 2n, 3n, 4n, 5n].map(company_id => ({ company_id, name: `Widget ${company_id}` }))
	const { insert_ids } = await helper.bulk_insert(connection, 'widget', rows, 2)

	assert.strictEqual(calls.length, 3)
	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (1, 'Widget 1', NULL), (2, 'Widget 2', NULL)",
	)
	assert.strictEqual(
		calls[1]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (3, 'Widget 3', NULL), (4, 'Widget 4', NULL)",
	)
	assert.strictEqual(
		calls[2]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (5, 'Widget 5', NULL)",
	)
	// Ids are consecutive within each batch, starting from that batch's reported insertId.
	assert.deepStrictEqual(insert_ids, [10n, 11n, 20n, 21n, 30n])
})

test('typed_insert_helper: bulk_insert returns one insert id per row for a single batch', async () => {
	const { connection, calls } = make_mock_connection([100])
	const helper = typed_insert_helper<TestSchema>(test_schema, test_insertable_schema)

	const { insert_ids } = await helper.bulk_insert(connection, 'widget', [
		{ company_id: 1n, name: 'a' },
		{ company_id: 2n, name: 'b' },
		{ company_id: 3n, name: 'c' },
	], 1000)

	assert.strictEqual(calls.length, 1)
	assert.deepStrictEqual(insert_ids, [100n, 101n, 102n])
})

test('typed_insert_helper: bulk_insert rejects a non-positive or fractional rows_per_batch', async () => {
	const { connection } = make_mock_connection()
	const helper = typed_insert_helper<TestSchema>(test_schema, test_insertable_schema)
	const rows = [{ company_id: 1n, name: 'a' }]

	await assert.rejects(async () => helper.bulk_insert(connection, 'widget', rows, 0))
	await assert.rejects(async () => helper.bulk_insert(connection, 'widget', rows, -5))
	await assert.rejects(async () => helper.bulk_insert(connection, 'widget', rows, 1.5))
})
