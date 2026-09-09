import { test } from 'node:test'
import * as assert from 'node:assert'
import type { Connection } from 'mysql2/promise'
import { Temporal } from '@js-temporal/polyfill'
import type { FinancialNumber } from 'financial-number'
import fnum from '#shared/fnum.ts'
import typed_write_helper from './typed_write_helper.ts'
import { fns } from './mysql_function.ts'

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

// The whole-row schema (every column, like Schema): updates may set any of these, including
// columns that are not insertable.
type TestRowSchema = {
	widget: {
		widget_id: bigint
		company_id: bigint
		name: string
		description: string | null
		created_at: string
	}
	gadget: {
		gadget_id: bigint
		company_id: bigint
		widget_id: bigint
		quantity: bigint
		created_at: string
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

const make_write_helper = typed_write_helper<TestSchema, TestRowSchema>({
	schema_constants: test_schema,
	insertable_column_names: test_insertable_schema,
	tables_unique_on_company_id: {},
})

const make_helper = (connection: Connection, company_id: bigint = 7n) => make_write_helper({ connection, company_id })

// insert_ids lets a test control the insertId reported for each successive query (a real multi-row
// INSERT reports the first id of the statement's consecutive block).
const make_mock_connection = (insert_ids: number[] = []) => {
	const calls: Array<{ sql: string }> = []
	const connection = {
		query: (sql: string) => {
			const insertId = insert_ids[calls.length] ?? 1
			calls.push({ sql })
			return Promise.resolve([{ insertId, affectedRows: 1 }, []])
		},
	} as unknown as Connection
	return { connection, calls }
}

// results holds what each successive query resolves to: a single header for a single-statement
// call, or an array of headers for a multi-statement call.
const make_update_mock_connection = (results: Array<{ affectedRows: number, insertId?: number } | Array<{ affectedRows: number }>> = []) => {
	const calls: Array<{ sql: string }> = []
	const connection = {
		query: (sql: string) => {
			const result = results[calls.length] ?? { affectedRows: 1, insertId: 0 }
			calls.push({ sql })
			return Promise.resolve([Array.isArray(result) ? result : { insertId: 0, ...result }, []])
		},
	} as unknown as Connection
	return { connection, calls }
}

// A schema with every kind of table: tenanted (has company_id), global (does not), and unique
// on company_id (counter, and company itself). The company table is the odd one out — its row
// has company_id (the primary key) but its insertable columns do not, so it is inserted as a
// global table and updated as a tenanted one.
type MixedSchema = {
	widget: { company_id: bigint, name: string }
	session: { token: string }
	company: { name: string }
	counter: { company_id: bigint, next_number: bigint }
}
type MixedRowSchema = {
	widget: { widget_id: bigint, company_id: bigint, name: string }
	session: { session_id: bigint, token: string }
	company: { company_id: bigint, name: string }
	counter: { counter_id: bigint, company_id: bigint, next_number: bigint }
}
const mixed_schema = {
	widget: { widget_id: 'widget_id', company_id: 'company_id', name: 'name' },
	session: { session_id: 'session_id', token: 'token' },
	company: { company_id: 'company_id', name: 'name' },
	counter: { counter_id: 'counter_id', company_id: 'company_id', next_number: 'next_number' },
} as const
const mixed_insertable_schema = {
	widget: { company_id: 'company_id', name: 'name' },
	session: { token: 'token' },
	company: { name: 'name' },
	counter: { company_id: 'company_id', next_number: 'next_number' },
} as const
const mixed_tables_unique_on_company_id = { company: 'company', counter: 'counter' } as const
const make_mixed_write_helper = typed_write_helper<MixedSchema, MixedRowSchema, keyof typeof mixed_tables_unique_on_company_id>({
	schema_constants: mixed_schema,
	insertable_column_names: mixed_insertable_schema,
	tables_unique_on_company_id: mixed_tables_unique_on_company_id,
})

test('typed_write_helper: schema constants must cover every table and column of both schemas', () => {
	// test_schema includes all of TestSchema's and TestRowSchema's tables/columns, so this is allowed.
	make_write_helper

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
	typed_write_helper<TestSchema, TestRowSchema>({ schema_constants: missing_name, insertable_column_names: test_insertable_schema, tables_unique_on_company_id: {} })

	const missing_created_at = {
		widget: {
			widget_id: 'widget_id',
			company_id: 'company_id',
			name: 'name',
			description: 'description',
		},
		gadget: test_schema.gadget,
	} as const
	// @ts-expect-error: widget is missing 'created_at', required by the row schema even though it is not insertable
	typed_write_helper<TestSchema, TestRowSchema>({ schema_constants: missing_created_at, insertable_column_names: test_insertable_schema, tables_unique_on_company_id: {} })

	const widget_only = {
		widget: test_schema.widget,
	} as const
	// @ts-expect-error: missing the entire 'gadget' table
	typed_write_helper<TestSchema, TestRowSchema>({ schema_constants: widget_only, insertable_column_names: test_insertable_schema, tables_unique_on_company_id: {} })
})

test('typed_write_helper: the insertable column-name map must also cover every insertable column', () => {
	const insertable_missing_name = {
		widget: {
			company_id: 'company_id',
			description: 'description',
		},
		gadget: test_insertable_schema.gadget,
	} as const
	// @ts-expect-error: the insertable column-name map is missing the required 'name' column
	typed_write_helper<TestSchema, TestRowSchema>({ schema_constants: test_schema, insertable_column_names: insertable_missing_name, tables_unique_on_company_id: {} })

	const insertable_widget_only = {
		widget: test_insertable_schema.widget,
	} as const
	// @ts-expect-error: the insertable column-name map is missing the entire 'gadget' table
	typed_write_helper<TestSchema, TestRowSchema>({ schema_constants: test_schema, insertable_column_names: insertable_widget_only, tables_unique_on_company_id: {} })
})

test('typed_write_helper: company_id must be a bigint or an explicit null', () => {
	const { connection } = make_mock_connection()

	make_write_helper({ connection, company_id: 1n })
	make_write_helper({ connection, company_id: null })

	// @ts-expect-error: company_id is required
	make_write_helper({ connection })

	// @ts-expect-error: a company_id that may or may not be null must be narrowed first
	make_write_helper({ connection, company_id: 1n as bigint | null })

	// @ts-expect-error: company_id is a bigint, not a number
	make_write_helper({ connection, company_id: 1 })
})

test('typed_write_helper: insert enforces column names and value types', async () => {
	const { connection } = make_mock_connection()
	const helper = make_helper(connection)

	helper.insert('widget', { name: 'Sprocket', description: null })
	helper.insert('widget', { name: 'Sprocket', description: 'a description' })
	helper.insert('gadget', { widget_id: 2n, quantity: 3n })

	// @ts-expect-error: name must be a string
	helper.insert('widget', { name: 5n, description: null })

	// @ts-expect-error: 'name' is a required column
	helper.insert('widget', { description: null })

	await assert.rejects(async () => {
		// @ts-expect-error: 'sprockets' is not a column on widget
		await helper.insert('widget', { name: 'x', description: null, sprockets: 1n })
	})

	await assert.rejects(async () => {
		// @ts-expect-error: 'not_a_table' is not a table in TestSchema
		await helper.insert('not_a_table', {})
	})
})

test('typed_write_helper: a company-bound helper supplies company_id on insert and refuses one in the row', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = make_helper(connection, 7n)

	await helper.insert('widget', { name: 'Sprocket', description: null })
	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (7, 'Sprocket', NULL)",
	)

	await assert.rejects(async () => {
		// @ts-expect-error: company_id is not accepted in the row
		await helper.insert('widget', { company_id: 7n, name: 'Sprocket', description: null })
	})

	// A row built elsewhere can carry company_id past the type check; the runtime check still refuses it.
	const smuggled = (): { name: string } => ({ name: 'Sprocket', company_id: 8n } as { name: string })
	await assert.rejects(async () => {
		await helper.insert('widget', smuggled())
	})
	assert.strictEqual(calls.length, 1)
})

test('typed_write_helper: insert escapes string values against injection', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = make_helper(connection)

	await helper.insert('widget', { name: "O'Sprocket'); DROP TABLE widget; --", description: null })

	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (7, 'O\\'Sprocket\\'); DROP TABLE widget; --', NULL)",
	)
})

test('typed_write_helper: serializes Temporal and FinancialNumber values for the driver', async () => {
	type EventSchema = {
		event: {
			company_id: bigint
			happens_on: Temporal.PlainDate | null
			price: FinancialNumber
		}
	}
	type EventRowSchema = {
		event: {
			event_id: bigint
			company_id: bigint
			happens_on: Temporal.PlainDate | null
			price: FinancialNumber
			created_at: string
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
	const helper = typed_write_helper<EventSchema, EventRowSchema>({
		schema_constants: event_schema,
		insertable_column_names: event_insertable_schema,
		tables_unique_on_company_id: {},
	})({ connection, company_id: 1n })

	await helper.insert('event', {
		happens_on: Temporal.PlainDate.from('2026-06-15'),
		price: fnum('12.34'),
	})

	// bigint renders as a numeric literal; Temporal.PlainDate and FinancialNumber become quoted MySQL strings.
	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `event` (`company_id`, `happens_on`, `price`) VALUES (1, '2026-06-15', '12.34')",
	)

	assert.strictEqual(
		helper.build_update_sql('event', 'event_id', 5n, {
			happens_on: Temporal.PlainDate.from('2026-06-15'),
			price: fnum('12.34'),
		}),
		"UPDATE `event` SET `happens_on` = '2026-06-15', `price` = '12.34' WHERE `event_id` = 5 AND `company_id` = 1",
	)
})

test('typed_write_helper: nullable columns may be omitted; non-nullable columns are required', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = make_helper(connection, 1n)

	// description is `string | null`, so it can be left out entirely.
	await helper.insert('widget', { name: 'Sprocket' })
	assert.strictEqual(calls[0]!.sql, "INSERT INTO `widget` (`company_id`, `name`) VALUES (1, 'Sprocket')")

	// @ts-expect-error: 'name' is not nullable, so it still must be provided
	helper.insert('widget', {})
})

test('typed_write_helper: bulk_insert enforces row types, column names, and an array of rows', async () => {
	const { connection } = make_mock_connection()
	const helper = make_helper(connection)

	helper.bulk_insert('widget', [
		{ name: 'Sprocket', description: null },
		{ name: 'Cog', description: 'geared' },
	], 1000)
	// description is nullable, so it may be omitted from a row.
	helper.bulk_insert('widget', [{ name: 'Sprocket' }], 1000)
	helper.bulk_insert('gadget', [{ widget_id: 2n, quantity: 3n }], 1000)

	// @ts-expect-error: name must be a string
	helper.bulk_insert('widget', [{ name: 5n, description: null }], 1000)

	// @ts-expect-error: 'name' is a required column
	helper.bulk_insert('widget', [{ description: null }], 1000)

	// @ts-expect-error: 'sprockets' is not a column on widget (only insertable columns are written,
	// so at runtime an unknown key is simply ignored — the error here is purely at the type level).
	helper.bulk_insert('widget', [{ name: 'x', description: null, sprockets: 1n }], 1000)

	await assert.rejects(async () => {
		// @ts-expect-error: company_id is not accepted in a row
		await helper.bulk_insert('widget', [{ company_id: 1n, name: 'x', description: null }], 1000)
	})

	await assert.rejects(async () => {
		// @ts-expect-error: rows must be an array, not a single row object
		await helper.bulk_insert('widget', { name: 'x', description: null }, 1000)
	})

	await assert.rejects(async () => {
		// @ts-expect-error: 'not_a_table' is not a table in TestSchema
		await helper.bulk_insert('not_a_table', [{}], 1000)
	})
})

test('typed_write_helper: bulk_insert writes every insertable column for every row, null for missing', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = make_helper(connection, 7n)

	await helper.bulk_insert('widget', [
		{ name: 'Sprocket', description: 'first' },
		// description omitted -> inserted as null; the column list stays identical.
		{ name: 'Cog' },
	], 1000)

	assert.strictEqual(calls.length, 1)
	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (7, 'Sprocket', 'first'), (7, 'Cog', NULL)",
	)
})

test('typed_write_helper: bulk_insert rejects an empty rows array', async () => {
	const { connection } = make_mock_connection()
	const helper = make_helper(connection)

	await assert.rejects(async () => {
		await helper.bulk_insert('widget', [], 1000)
	})
})

test('typed_write_helper: bulk_insert splits rows into batches of rows_per_batch', async () => {
	// Each query reports the first insert id of its batch, as MySQL does.
	const { connection, calls } = make_mock_connection([10, 20, 30])
	const helper = make_helper(connection, 1n)

	const rows = [1, 2, 3, 4, 5].map(n => ({ name: `Widget ${n}` }))
	const { insert_ids } = await helper.bulk_insert('widget', rows, 2)

	assert.strictEqual(calls.length, 3)
	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (1, 'Widget 1', NULL), (1, 'Widget 2', NULL)",
	)
	assert.strictEqual(
		calls[1]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (1, 'Widget 3', NULL), (1, 'Widget 4', NULL)",
	)
	assert.strictEqual(
		calls[2]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (1, 'Widget 5', NULL)",
	)
	// Ids are consecutive within each batch, starting from that batch's reported insertId.
	assert.deepStrictEqual(insert_ids, [10n, 11n, 20n, 21n, 30n])
})

test('typed_write_helper: bulk_insert returns one insert id per row for a single batch', async () => {
	const { connection, calls } = make_mock_connection([100])
	const helper = make_helper(connection)

	const { insert_ids } = await helper.bulk_insert('widget', [
		{ name: 'a' },
		{ name: 'b' },
		{ name: 'c' },
	], 1000)

	assert.strictEqual(calls.length, 1)
	assert.deepStrictEqual(insert_ids, [100n, 101n, 102n])
})

test('typed_write_helper: bulk_insert rejects a non-positive or fractional rows_per_batch', async () => {
	const { connection } = make_mock_connection()
	const helper = make_helper(connection)
	const rows = [{ name: 'a' }]

	await assert.rejects(async () => helper.bulk_insert('widget', rows, 0))
	await assert.rejects(async () => helper.bulk_insert('widget', rows, -5))
	await assert.rejects(async () => helper.bulk_insert('widget', rows, 1.5))
})

test('typed_write_helper: build_update_sql builds an UPDATE with escaped values inlined and the company filter', () => {
	const helper = make_helper(make_mock_connection().connection, 7n)

	assert.strictEqual(
		helper.build_update_sql('widget', 'widget_id', 5n, { name: "O'Sprocket", description: null }),
		"UPDATE `widget` SET `name` = 'O\\'Sprocket', `description` = NULL WHERE `widget_id` = 5 AND `company_id` = 7",
	)
})

test('typed_write_helper: build_update_sql skips undefined columns and requires at least one set column', () => {
	const helper = make_helper(make_mock_connection().connection)

	assert.strictEqual(
		helper.build_update_sql('widget', 'widget_id', 5n, { name: 'Sprocket', description: undefined }),
		"UPDATE `widget` SET `name` = 'Sprocket' WHERE `widget_id` = 5 AND `company_id` = 7",
	)

	assert.throws(() => helper.build_update_sql('widget', 'widget_id', 5n, {}))
	assert.throws(() => helper.build_update_sql('widget', 'widget_id', 5n, { description: undefined }))
})

type UpdateSetSmuggledColumn = { name?: string; description?: string | null }

test('typed_write_helper: build_update_sql enforces table, column, value type, and set column types', () => {
	const helper = make_helper(make_mock_connection().connection)

	// created_at is not insertable, but the row schema makes it updatable and usable as the column.
	helper.build_update_sql('widget', 'created_at', 'x', { name: 'Sprocket' })
	helper.build_update_sql('widget', 'widget_id', 5n, { created_at: 'x' })

	// @ts-expect-error: 'not_a_column' is not a column on widget
	assert.throws(() => helper.build_update_sql('widget', 'not_a_column', 5n, { name: 'x' }))

	// @ts-expect-error: widget_id is a bigint, not a string
	helper.build_update_sql('widget', 'widget_id', 'five', { name: 'x' })

	// @ts-expect-error: name must be a string
	helper.build_update_sql('widget', 'widget_id', 5n, { name: 5n })

	assert.throws(() => {
		// @ts-expect-error: 'sprockets' is not a column on widget
		helper.build_update_sql('widget', 'widget_id', 5n, { sprockets: 1n })
	})

	// @ts-expect-error: 'not_a_table' is not a table in TestRowSchema
	assert.throws(() => helper.build_update_sql('not_a_table', 'widget_id', 5n, { name: 'x' }))

	// The runtime assertion also catches an unknown set column smuggled past the types.
	assert.throws(() => helper.build_update_sql('widget', 'widget_id', 5n, { sprockets: 1n } as UpdateSetSmuggledColumn))
})

test('typed_write_helper: updates may not move a row to another company', () => {
	const helper = make_helper(make_mock_connection().connection, 7n)

	assert.throws(() => {
		// @ts-expect-error: company_id may not be set
		helper.build_update_sql('widget', 'widget_id', 5n, { company_id: 8n })
	})
	assert.throws(() => {
		// @ts-expect-error: company_id may not be set even alongside a valid column
		helper.build_update_sql('widget', 'widget_id', 5n, { name: 'x', company_id: 8n })
	})

	// Smuggled past the types, the runtime check still refuses it.
	const smuggled = (): { name: string } => ({ name: 'x', company_id: 8n } as { name: string })
	assert.throws(() => helper.build_update_sql('widget', 'widget_id', 5n, smuggled()))

	// company_id may still be the column; the company filter is then redundant but harmless.
	assert.strictEqual(
		helper.build_update_sql('widget', 'company_id', 7n, { name: 'x' }),
		"UPDATE `widget` SET `name` = 'x' WHERE `company_id` = 7 AND `company_id` = 7",
	)
})

test('typed_write_helper: updates reject a set whose type has a column not on the table', async () => {
	const { connection } = make_update_mock_connection()
	const helper = make_helper(connection)

	// A non-literal value dodges excess-property checking, and one valid column alongside the
	// misnamed one dodges the weak-type check, so the misnamed column must be rejected
	// structurally, not just when the set is written inline.
	const misnamed_fields = (): { namez: string; description: string } => ({ namez: 'Sprocket', description: 'x' })

	assert.throws(() => {
		// @ts-expect-error: 'namez' is not a column on widget
		helper.build_update_sql('widget', 'widget_id', 5n, misnamed_fields())
	})

	await assert.rejects(async () => {
		// @ts-expect-error: 'namez' is not a column on widget
		await helper.update('widget', 'widget_id', 5n, misnamed_fields())
	})

	await assert.rejects(async () => {
		// @ts-expect-error: 'namez' is not a column on widget
		await helper.bulk_update('widget', 'widget_id', [{ value: 1n, set: misnamed_fields() }], 10)
	})
})

test('typed_write_helper: update runs a single UPDATE and returns its affected rows and insert id', async () => {
	const { connection, calls } = make_update_mock_connection([{ affectedRows: 1, insertId: 7 }])
	const helper = make_helper(connection, 3n)

	const { affected_rows, insert_id } = await helper.update('widget', 'widget_id', 5n, { name: 'Sprocket' })

	assert.strictEqual(calls.length, 1)
	assert.strictEqual(calls[0]!.sql, "UPDATE `widget` SET `name` = 'Sprocket' WHERE `widget_id` = 5 AND `company_id` = 3")
	assert.strictEqual(affected_rows, 1n)
	assert.strictEqual(insert_id, 7n)
})

test('typed_write_helper: bulk_update sends one UPDATE per row, batched into single query calls', async () => {
	const { connection, calls } = make_update_mock_connection([
		[{ affectedRows: 1 }, { affectedRows: 1 }],
		{ affectedRows: 1 },
	])
	const helper = make_helper(connection, 7n)

	// Rows may set different subsets of columns.
	const { affected_rows } = await helper.bulk_update('widget', 'widget_id', [
		{ value: 1n, set: { name: 'a' } },
		{ value: 2n, set: { description: 'b' } },
		{ value: 3n, set: { name: 'c', description: null } },
	], 2)

	assert.strictEqual(calls.length, 2)
	assert.strictEqual(
		calls[0]!.sql,
		"UPDATE `widget` SET `name` = 'a' WHERE `widget_id` = 1 AND `company_id` = 7;\nUPDATE `widget` SET `description` = 'b' WHERE `widget_id` = 2 AND `company_id` = 7",
	)
	assert.strictEqual(
		calls[1]!.sql,
		"UPDATE `widget` SET `name` = 'c', `description` = NULL WHERE `widget_id` = 3 AND `company_id` = 7",
	)
	assert.strictEqual(affected_rows, 3n)
})

test('typed_write_helper: bulk_update enforces row types', async () => {
	const { connection } = make_update_mock_connection()
	const helper = make_helper(connection)

	// @ts-expect-error: quantity must be a bigint
	helper.bulk_update('gadget', 'gadget_id', [{ value: 1n, set: { quantity: 'nope' } }], 10)

	await assert.rejects(async () => {
		// @ts-expect-error: 'sprockets' is not a column on gadget
		await helper.bulk_update('gadget', 'gadget_id', [{ value: 1n, set: { sprockets: 1n } }], 10)
	})

	// @ts-expect-error: gadget_id values are bigints
	helper.bulk_update('gadget', 'gadget_id', [{ value: 'one', set: { quantity: 2n } }], 10)

	await assert.rejects(async () => {
		// @ts-expect-error: 'not_a_table' is not a table in TestRowSchema
		await helper.bulk_update('not_a_table', 'gadget_id', [{ value: 1n, set: {} }], 10)
	})
})

test('typed_write_helper: bulk_update makes no query for an empty rows array', async () => {
	const { connection, calls } = make_update_mock_connection()
	const helper = make_helper(connection)

	const { affected_rows } = await helper.bulk_update('widget', 'widget_id', [], 10)

	assert.strictEqual(calls.length, 0)
	assert.strictEqual(affected_rows, 0n)
})

test('typed_write_helper: bulk_update rejects a non-positive or fractional rows_per_batch', async () => {
	const { connection } = make_update_mock_connection()
	const helper = make_helper(connection)
	const rows = [{ value: 1n, set: { name: 'a' } }]

	await assert.rejects(async () => helper.bulk_update('widget', 'widget_id', rows, 0))
	await assert.rejects(async () => helper.bulk_update('widget', 'widget_id', rows, -5))
	await assert.rejects(async () => helper.bulk_update('widget', 'widget_id', rows, 1.5))
})

test('typed_write_helper: delete removes rows matching any of the values, with the company filter', async () => {
	const { connection, calls } = make_update_mock_connection([{ affectedRows: 2 }])
	const helper = make_helper(connection, 7n)

	const { affected_rows } = await helper.delete('widget', 'widget_id', [1n, 2n], 10)

	assert.strictEqual(calls.length, 1)
	assert.strictEqual(calls[0]!.sql, "DELETE FROM `widget` WHERE `widget_id` IN (1, 2) AND `company_id` = 7")
	assert.strictEqual(affected_rows, 2n)

	// Any column may drive the delete, and values are escaped.
	await helper.delete('widget', 'name', ["O'Sprocket"], 10)
	assert.strictEqual(calls[1]!.sql, "DELETE FROM `widget` WHERE `name` IN ('O\\'Sprocket') AND `company_id` = 7")
})

test('typed_write_helper: delete splits values into batches and sums the affected rows', async () => {
	const { connection, calls } = make_update_mock_connection([{ affectedRows: 2 }, { affectedRows: 1 }])
	const helper = make_helper(connection, 7n)

	const { affected_rows } = await helper.delete('widget', 'widget_id', [1n, 2n, 3n], 2)

	assert.strictEqual(calls.length, 2)
	assert.strictEqual(calls[0]!.sql, "DELETE FROM `widget` WHERE `widget_id` IN (1, 2) AND `company_id` = 7")
	assert.strictEqual(calls[1]!.sql, "DELETE FROM `widget` WHERE `widget_id` IN (3) AND `company_id` = 7")
	assert.strictEqual(affected_rows, 3n)
})

test('typed_write_helper: delete makes no query for an empty values array', async () => {
	const { connection, calls } = make_update_mock_connection()
	const helper = make_helper(connection)

	const { affected_rows } = await helper.delete('widget', 'widget_id', [], 10)

	assert.strictEqual(calls.length, 0)
	assert.strictEqual(affected_rows, 0n)
})

test('typed_write_helper: delete enforces table, column, value types, and values_per_batch', async () => {
	const { connection } = make_update_mock_connection()
	const helper = make_helper(connection)

	// @ts-expect-error: widget_id values are bigints
	helper.delete('widget', 'widget_id', ['one'], 10)

	// @ts-expect-error: values must be an array
	helper.delete('widget', 'widget_id', 1n, 10)

	await assert.rejects(async () => {
		// @ts-expect-error: 'not_a_column' is not a column on widget
		await helper.delete('widget', 'not_a_column', [1n], 10)
	})

	await assert.rejects(async () => {
		// @ts-expect-error: 'not_a_table' is not a table in TestRowSchema
		await helper.delete('not_a_table', 'widget_id', [1n], 10)
	})

	await assert.rejects(async () => helper.delete('widget', 'widget_id', [1n], 0))
	await assert.rejects(async () => helper.delete('widget', 'widget_id', [1n], -5))
	await assert.rejects(async () => helper.delete('widget', 'widget_id', [1n], 1.5))
})

test('typed_write_helper: updates set updated_at = UTC_TIMESTAMP() on tables that have the column', async () => {
	type TrackedSchema = {
		tracked: {
			company_id: bigint
			name: string
		}
	}
	type TrackedRowSchema = {
		tracked: {
			tracked_id: bigint
			company_id: bigint
			name: string
			updated_at: Temporal.Instant
		}
	}
	const tracked_schema = {
		tracked: {
			tracked_id: 'tracked_id',
			company_id: 'company_id',
			name: 'name',
			updated_at: 'updated_at',
		},
	} as const
	const tracked_insertable_schema = {
		tracked: {
			company_id: 'company_id',
			name: 'name',
		},
	} as const

	const { connection, calls } = make_update_mock_connection()
	const helper = typed_write_helper<TrackedSchema, TrackedRowSchema>({
		schema_constants: tracked_schema,
		insertable_column_names: tracked_insertable_schema,
		tables_unique_on_company_id: {},
	})({ connection, company_id: 7n })

	assert.strictEqual(
		helper.build_update_sql('tracked', 'tracked_id', 5n, { name: 'Sprocket' }),
		"UPDATE `tracked` SET `name` = 'Sprocket', `updated_at` = UTC_TIMESTAMP() WHERE `tracked_id` = 5 AND `company_id` = 7",
	)

	// An explicit updated_at wins over the automatic one.
	assert.strictEqual(
		helper.build_update_sql('tracked', 'tracked_id', 5n, {
			name: 'Sprocket',
			updated_at: Temporal.Instant.from('2026-01-02T03:04:05Z'),
		}),
		"UPDATE `tracked` SET `name` = 'Sprocket', `updated_at` = '2026-01-02 03:04:05' WHERE `tracked_id` = 5 AND `company_id` = 7",
	)

	// An explicitly-undefined updated_at is skipped like any other column, so the automatic one applies.
	assert.strictEqual(
		helper.build_update_sql('tracked', 'tracked_id', 5n, { name: 'Sprocket', updated_at: undefined }),
		"UPDATE `tracked` SET `name` = 'Sprocket', `updated_at` = UTC_TIMESTAMP() WHERE `tracked_id` = 5 AND `company_id` = 7",
	)

	await helper.bulk_update('tracked', 'tracked_id', [{ value: 1n, set: { name: 'a' } }], 10)
	assert.strictEqual(
		calls[0]!.sql,
		"UPDATE `tracked` SET `name` = 'a', `updated_at` = UTC_TIMESTAMP() WHERE `tracked_id` = 1 AND `company_id` = 7",
	)
})

test('typed_write_helper: updates leave the SET clause alone on tables without an updated_at column', () => {
	const helper = make_helper(make_mock_connection().connection, 7n)

	assert.strictEqual(
		helper.build_update_sql('widget', 'widget_id', 5n, { name: 'Sprocket' }),
		"UPDATE `widget` SET `name` = 'Sprocket' WHERE `widget_id` = 5 AND `company_id` = 7",
	)
})

test('typed_write_helper: a company-bound helper only writes tables that have a company_id column', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = make_mixed_write_helper({ connection, company_id: 7n })

	await helper.insert('widget', { name: 'Sprocket' })
	assert.strictEqual(calls[0]!.sql, "INSERT INTO `widget` (`company_id`, `name`) VALUES (7, 'Sprocket')")

	await assert.rejects(async () => {
		// @ts-expect-error: session has no company_id column
		await helper.insert('session', { token: 'abc' })
	})
	await assert.rejects(async () => {
		// @ts-expect-error: session has no company_id column
		await helper.bulk_insert('session', [{ token: 'abc' }], 10)
	})
	assert.throws(() => {
		// @ts-expect-error: session has no company_id column
		helper.build_update_sql('session', 'session_id', 1n, { token: 'abc' })
	})
	await assert.rejects(async () => {
		// @ts-expect-error: session has no company_id column
		await helper.update('session', 'session_id', 1n, { token: 'abc' })
	})
	await assert.rejects(async () => {
		// @ts-expect-error: session has no company_id column
		await helper.bulk_update('session', 'session_id', [{ value: 1n, set: { token: 'abc' } }], 10)
	})
	await assert.rejects(async () => {
		// @ts-expect-error: session has no company_id column
		await helper.delete('session', 'session_id', [1n], 10)
	})

	// company has no insertable company_id (it is the auto-increment key), so a company-bound
	// helper cannot insert one, but it can update the company it is bound to.
	await assert.rejects(async () => {
		// @ts-expect-error: company's insertable columns do not include company_id
		await helper.insert('company', { name: 'Acme' })
	})
	assert.strictEqual(
		helper.build_update_sql('company', 'company_id', 7n, { name: 'Acme' }),
		"UPDATE `company` SET `name` = 'Acme' WHERE `company_id` = 7 AND `company_id` = 7",
	)
	assert.strictEqual(calls.length, 1)
})

test('typed_write_helper: a helper bound to no company only writes tables without a company_id column', async () => {
	const { connection, calls } = make_mock_connection([1, 2, 3, 1])
	const helper = make_mixed_write_helper({ connection, company_id: null })

	await helper.insert('session', { token: 'abc' })
	assert.strictEqual(calls[0]!.sql, "INSERT INTO `session` (`token`) VALUES ('abc')")

	await helper.bulk_insert('session', [{ token: 'a' }, { token: 'b' }], 10)
	assert.strictEqual(calls[1]!.sql, "INSERT INTO `session` (`token`) VALUES ('a'), ('b')")

	assert.strictEqual(
		helper.build_update_sql('session', 'session_id', 1n, { token: 'xyz' }),
		"UPDATE `session` SET `token` = 'xyz' WHERE `session_id` = 1",
	)

	await helper.delete('session', 'session_id', [1n, 2n], 10)
	assert.strictEqual(calls[2]!.sql, "DELETE FROM `session` WHERE `session_id` IN (1, 2)")

	// Creating a company: its insertable columns have no company_id, so it is a global insert.
	const { insert_id } = await helper.insert('company', { name: 'Acme' })
	assert.strictEqual(calls[3]!.sql, "INSERT INTO `company` (`name`) VALUES ('Acme')")
	assert.strictEqual(insert_id, 1n)

	await assert.rejects(async () => {
		// @ts-expect-error: widget has a company_id column
		await helper.insert('widget', { name: 'Sprocket' })
	})
	await assert.rejects(async () => {
		// @ts-expect-error: widget has a company_id column
		await helper.bulk_insert('widget', [{ name: 'Sprocket' }], 10)
	})
	assert.throws(() => {
		// @ts-expect-error: widget has a company_id column
		helper.build_update_sql('widget', 'widget_id', 1n, { name: 'Sprocket' })
	})
	assert.throws(() => {
		// @ts-expect-error: company rows have a company_id column
		helper.build_update_sql('company', 'company_id', 1n, { name: 'Acme' })
	})
	await assert.rejects(async () => {
		// @ts-expect-error: widget has a company_id column
		await helper.update('widget', 'widget_id', 1n, { name: 'Sprocket' })
	})
	await assert.rejects(async () => {
		// @ts-expect-error: widget has a company_id column
		await helper.bulk_update('widget', 'widget_id', [{ value: 1n, set: { name: 'Sprocket' } }], 10)
	})
	await assert.rejects(async () => {
		// @ts-expect-error: widget has a company_id column
		await helper.delete('widget', 'widget_id', [1n], 10)
	})
	assert.strictEqual(calls.length, 4)
})

test('typed_write_helper: tables unique on company_id must be tenanted tables in the schema', () => {
	assert.throws(() =>
		// @ts-expect-error: session has no company_id column
		typed_write_helper<MixedSchema, MixedRowSchema, 'session'>({
			schema_constants: mixed_schema,
			insertable_column_names: mixed_insertable_schema,
			tables_unique_on_company_id: { session: 'session' },
		}))

	assert.throws(() =>
		// @ts-expect-error: not_a_table is not in the schema
		typed_write_helper<MixedSchema, MixedRowSchema, 'not_a_table'>({
			schema_constants: mixed_schema,
			insertable_column_names: mixed_insertable_schema,
			tables_unique_on_company_id: { not_a_table: 'not_a_table' },
		}))
})

test('typed_write_helper: update_company_row updates the bound company\'s row of a table unique on company_id', async () => {
	const { connection, calls } = make_update_mock_connection([{ affectedRows: 1, insertId: 42 }])
	const helper = make_mixed_write_helper({ connection, company_id: 7n })

	const { affected_rows, insert_id } = await helper.update_company_row('counter', {
		next_number: fns.last_insert_id_increment('next_number', 1n),
	})
	assert.strictEqual(calls[0]!.sql, "UPDATE `counter` SET `next_number` = LAST_INSERT_ID(`next_number`) + 1 WHERE `company_id` = 7")
	assert.strictEqual(affected_rows, 1n)
	assert.strictEqual(insert_id, 42n)

	await helper.update_company_row('company', { name: 'Acme' })
	assert.strictEqual(calls[1]!.sql, "UPDATE `company` SET `name` = 'Acme' WHERE `company_id` = 7")

	await assert.rejects(async () => {
		// @ts-expect-error: widget is not unique on company_id
		await helper.update_company_row('widget', { name: 'Sprocket' })
	})
	await assert.rejects(async () => {
		// @ts-expect-error: session has no company_id column
		await helper.update_company_row('session', { token: 'abc' })
	})
	// Smuggled past the types, the runtime check still refuses a table that is not unique on company_id.
	await assert.rejects(async () => {
		await helper.update_company_row('widget' as 'counter', { next_number: 1n })
	})
	await assert.rejects(async () => {
		// @ts-expect-error: company_id may not be set
		await helper.update_company_row('counter', { company_id: 8n })
	})
	assert.strictEqual(calls.length, 2)

	// @ts-expect-error: next_number is a bigint
	helper.update_company_row('counter', { next_number: 'one' })
})

test('typed_write_helper: a helper bound to no company has no update_company_row', async () => {
	const { connection, calls } = make_update_mock_connection()
	const helper = make_mixed_write_helper({ connection, company_id: null })

	await assert.rejects(async () => {
		// @ts-expect-error: update_company_row only exists on a company-bound helper
		await helper.update_company_row('counter', { next_number: 1n })
	})
	assert.strictEqual(calls.length, 0)
})

test('typed_write_helper: MySQLFunction values render as SQL function calls in writes', async () => {
	type SessionSchema = {
		session: {
			employee_id: bigint
			identifier: Buffer
			last_seen_at: Temporal.Instant
		}
	}
	type SessionRowSchema = {
		session: {
			session_id: bigint
			employee_id: bigint
			identifier: Buffer
			last_seen_at: Temporal.Instant
		}
	}
	const session_schema = {
		session: {
			session_id: 'session_id',
			employee_id: 'employee_id',
			identifier: 'identifier',
			last_seen_at: 'last_seen_at',
		},
	} as const
	const session_insertable_schema = {
		session: {
			employee_id: 'employee_id',
			identifier: 'identifier',
			last_seen_at: 'last_seen_at',
		},
	} as const

	const { connection, calls } = make_mock_connection()
	const helper = typed_write_helper<SessionSchema, SessionRowSchema>({
		schema_constants: session_schema,
		insertable_column_names: session_insertable_schema,
		tables_unique_on_company_id: {},
	})({ connection, company_id: null })

	await helper.insert('session', {
		employee_id: 1n,
		identifier: fns.uuid_to_bin('123e4567-e89b-12d3-a456-426614174000'),
		last_seen_at: fns.utc_timestamp(),
	})
	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `session` (`employee_id`, `identifier`, `last_seen_at`) VALUES (1, UUID_TO_BIN('123e4567-e89b-12d3-a456-426614174000'), UTC_TIMESTAMP())",
	)

	await helper.bulk_insert('session', [{
		employee_id: 2n,
		identifier: fns.uuid_to_bin('223e4567-e89b-12d3-a456-426614174000'),
		last_seen_at: fns.utc_timestamp(),
	}], 10)
	assert.strictEqual(
		calls[1]!.sql,
		"INSERT INTO `session` (`employee_id`, `identifier`, `last_seen_at`) VALUES (2, UUID_TO_BIN('223e4567-e89b-12d3-a456-426614174000'), UTC_TIMESTAMP())",
	)

	assert.strictEqual(
		helper.build_update_sql('session', 'identifier', fns.uuid_to_bin('323e4567-e89b-12d3-a456-426614174000'), {
			last_seen_at: fns.utc_timestamp(),
		}),
		"UPDATE `session` SET `last_seen_at` = UTC_TIMESTAMP() WHERE `identifier` = UUID_TO_BIN('323e4567-e89b-12d3-a456-426614174000')",
	)

	helper.insert('session', {
		// @ts-expect-error: utc_timestamp claims Temporal.Instant, which is not assignable to a bigint column
		employee_id: fns.utc_timestamp(),
		identifier: fns.uuid_to_bin('123e4567-e89b-12d3-a456-426614174000'),
		last_seen_at: fns.utc_timestamp(),
	})
})
