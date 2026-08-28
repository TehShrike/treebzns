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

const make_helper = () => typed_write_helper<TestSchema, TestRowSchema>(test_schema, test_insertable_schema)

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

test('typed_write_helper: schema constants must cover every table and column of both schemas', () => {
	// test_schema includes all of TestSchema's and TestRowSchema's tables/columns, so this is allowed.
	make_helper()

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
	typed_write_helper<TestSchema, TestRowSchema>(missing_name, test_insertable_schema)

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
	typed_write_helper<TestSchema, TestRowSchema>(missing_created_at, test_insertable_schema)

	const widget_only = {
		widget: test_schema.widget,
	} as const
	// @ts-expect-error: missing the entire 'gadget' table
	typed_write_helper<TestSchema, TestRowSchema>(widget_only, test_insertable_schema)
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
	typed_write_helper<TestSchema, TestRowSchema>(test_schema, insertable_missing_name)

	const insertable_widget_only = {
		widget: test_insertable_schema.widget,
	} as const
	// @ts-expect-error: the insertable column-name map is missing the entire 'gadget' table
	typed_write_helper<TestSchema, TestRowSchema>(test_schema, insertable_widget_only)
})

test('typed_write_helper: insert enforces column names and value types', async () => {
	const { connection } = make_mock_connection()
	const helper = make_helper()

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

test('typed_write_helper: insert builds an INSERT statement with escaped values inlined', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = make_helper()

	await helper.insert(connection, 'widget', { company_id: 7n, name: 'Sprocket', description: null })

	assert.strictEqual(calls.length, 1)
	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (7, 'Sprocket', NULL)",
	)
})

test('typed_write_helper: insert escapes string values against injection', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = make_helper()

	await helper.insert(connection, 'widget', { company_id: 7n, name: "O'Sprocket'); DROP TABLE widget; --", description: null })

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
	const helper = typed_write_helper<EventSchema, EventRowSchema>(event_schema, event_insertable_schema)

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

	assert.strictEqual(
		helper.build_update_sql('event', 'event_id', 5n, {
			happens_on: Temporal.PlainDate.from('2026-06-15'),
			price: fnum('12.34'),
		}),
		"UPDATE `event` SET `happens_on` = '2026-06-15', `price` = '12.34' WHERE `event_id` = 5",
	)
})

test('typed_write_helper: nullable columns may be omitted; non-nullable columns are required', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = make_helper()

	// description is `string | null`, so it can be left out entirely.
	await helper.insert(connection, 'widget', { company_id: 1n, name: 'Sprocket' })
	assert.strictEqual(calls[0]!.sql, "INSERT INTO `widget` (`company_id`, `name`) VALUES (1, 'Sprocket')")

	// @ts-expect-error: 'name' is not nullable, so it still must be provided
	helper.insert(connection, 'widget', { company_id: 1n })
})

test('typed_write_helper: bulk_insert enforces row types, column names, and an array of rows', async () => {
	const { connection } = make_mock_connection()
	const helper = make_helper()

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

test('typed_write_helper: bulk_insert writes every insertable column for every row, null for missing', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = make_helper()

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

test('typed_write_helper: bulk_insert rejects an empty rows array', async () => {
	const { connection } = make_mock_connection()
	const helper = make_helper()

	await assert.rejects(async () => {
		await helper.bulk_insert(connection, 'widget', [], 1000)
	})
})

test('typed_write_helper: bulk_insert splits rows into batches of rows_per_batch', async () => {
	// Each query reports the first insert id of its batch, as MySQL does.
	const { connection, calls } = make_mock_connection([10, 20, 30])
	const helper = make_helper()

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

test('typed_write_helper: bulk_insert returns one insert id per row for a single batch', async () => {
	const { connection, calls } = make_mock_connection([100])
	const helper = make_helper()

	const { insert_ids } = await helper.bulk_insert(connection, 'widget', [
		{ company_id: 1n, name: 'a' },
		{ company_id: 2n, name: 'b' },
		{ company_id: 3n, name: 'c' },
	], 1000)

	assert.strictEqual(calls.length, 1)
	assert.deepStrictEqual(insert_ids, [100n, 101n, 102n])
})

test('typed_write_helper: bulk_insert rejects a non-positive or fractional rows_per_batch', async () => {
	const { connection } = make_mock_connection()
	const helper = make_helper()
	const rows = [{ company_id: 1n, name: 'a' }]

	await assert.rejects(async () => helper.bulk_insert(connection, 'widget', rows, 0))
	await assert.rejects(async () => helper.bulk_insert(connection, 'widget', rows, -5))
	await assert.rejects(async () => helper.bulk_insert(connection, 'widget', rows, 1.5))
})

test('typed_write_helper: build_update_sql builds an UPDATE with escaped values inlined', () => {
	const helper = make_helper()

	assert.strictEqual(
		helper.build_update_sql('widget', 'widget_id', 5n, { name: "O'Sprocket", description: null }),
		"UPDATE `widget` SET `name` = 'O\\'Sprocket', `description` = NULL WHERE `widget_id` = 5",
	)
})

test('typed_write_helper: build_update_sql skips undefined columns and requires at least one set column', () => {
	const helper = make_helper()

	assert.strictEqual(
		helper.build_update_sql('widget', 'widget_id', 5n, { name: 'Sprocket', description: undefined }),
		"UPDATE `widget` SET `name` = 'Sprocket' WHERE `widget_id` = 5",
	)

	assert.throws(() => helper.build_update_sql('widget', 'widget_id', 5n, {}))
	assert.throws(() => helper.build_update_sql('widget', 'widget_id', 5n, { description: undefined }))
})

type UpdateSetSmuggledColumn = { name?: string; description?: string | null }

test('typed_write_helper: build_update_sql enforces table, key column, key type, and set column types', () => {
	const helper = make_helper()

	// created_at is not insertable, but the row schema makes it updatable and usable as a key.
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

test('typed_write_helper: updates reject a set whose type has a column not on the table', async () => {
	const { connection } = make_update_mock_connection()
	const helper = make_helper()

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
		await helper.update(connection, 'widget', 'widget_id', 5n, misnamed_fields())
	})

	await assert.rejects(async () => {
		// @ts-expect-error: 'namez' is not a column on widget
		await helper.bulk_update(connection, 'widget', 'widget_id', [{ key: 1n, set: misnamed_fields() }], 10)
	})
})

test('typed_write_helper: update runs a single UPDATE and returns its affected rows and insert id', async () => {
	const { connection, calls } = make_update_mock_connection([{ affectedRows: 1, insertId: 7 }])
	const helper = make_helper()

	const { affected_rows, insert_id } = await helper.update(connection, 'widget', 'widget_id', 5n, { name: 'Sprocket' })

	assert.strictEqual(calls.length, 1)
	assert.strictEqual(calls[0]!.sql, "UPDATE `widget` SET `name` = 'Sprocket' WHERE `widget_id` = 5")
	assert.strictEqual(affected_rows, 1n)
	assert.strictEqual(insert_id, 7n)
})

test('typed_write_helper: bulk_update sends one UPDATE per row, batched into single query calls', async () => {
	const { connection, calls } = make_update_mock_connection([
		[{ affectedRows: 1 }, { affectedRows: 1 }],
		{ affectedRows: 1 },
	])
	const helper = make_helper()

	// Rows may set different subsets of columns.
	const { affected_rows } = await helper.bulk_update(connection, 'widget', 'widget_id', [
		{ key: 1n, set: { name: 'a' } },
		{ key: 2n, set: { description: 'b' } },
		{ key: 3n, set: { name: 'c', description: null } },
	], 2)

	assert.strictEqual(calls.length, 2)
	assert.strictEqual(
		calls[0]!.sql,
		"UPDATE `widget` SET `name` = 'a' WHERE `widget_id` = 1;\nUPDATE `widget` SET `description` = 'b' WHERE `widget_id` = 2",
	)
	assert.strictEqual(
		calls[1]!.sql,
		"UPDATE `widget` SET `name` = 'c', `description` = NULL WHERE `widget_id` = 3",
	)
	assert.strictEqual(affected_rows, 3n)
})

test('typed_write_helper: bulk_update enforces row types', async () => {
	const { connection } = make_update_mock_connection()
	const helper = make_helper()

	// @ts-expect-error: quantity must be a bigint
	helper.bulk_update(connection, 'gadget', 'gadget_id', [{ key: 1n, set: { quantity: 'nope' } }], 10)

	await assert.rejects(async () => {
		// @ts-expect-error: 'sprockets' is not a column on gadget
		await helper.bulk_update(connection, 'gadget', 'gadget_id', [{ key: 1n, set: { sprockets: 1n } }], 10)
	})

	// @ts-expect-error: gadget_id keys are bigints
	helper.bulk_update(connection, 'gadget', 'gadget_id', [{ key: 'one', set: { quantity: 2n } }], 10)

	await assert.rejects(async () => {
		// @ts-expect-error: 'not_a_table' is not a table in TestRowSchema
		await helper.bulk_update(connection, 'not_a_table', 'gadget_id', [{ key: 1n, set: {} }], 10)
	})
})

test('typed_write_helper: bulk_update makes no query for an empty rows array', async () => {
	const { connection, calls } = make_update_mock_connection()
	const helper = make_helper()

	const { affected_rows } = await helper.bulk_update(connection, 'widget', 'widget_id', [], 10)

	assert.strictEqual(calls.length, 0)
	assert.strictEqual(affected_rows, 0n)
})

test('typed_write_helper: bulk_update rejects a non-positive or fractional rows_per_batch', async () => {
	const { connection } = make_update_mock_connection()
	const helper = make_helper()
	const rows = [{ key: 1n, set: { name: 'a' } }]

	await assert.rejects(async () => helper.bulk_update(connection, 'widget', 'widget_id', rows, 0))
	await assert.rejects(async () => helper.bulk_update(connection, 'widget', 'widget_id', rows, -5))
	await assert.rejects(async () => helper.bulk_update(connection, 'widget', 'widget_id', rows, 1.5))
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

	const helper = typed_write_helper<TrackedSchema, TrackedRowSchema>(tracked_schema, tracked_insertable_schema)

	assert.strictEqual(
		helper.build_update_sql('tracked', 'tracked_id', 5n, { name: 'Sprocket' }),
		"UPDATE `tracked` SET `name` = 'Sprocket', `updated_at` = UTC_TIMESTAMP() WHERE `tracked_id` = 5",
	)

	// An explicit updated_at wins over the automatic one.
	assert.strictEqual(
		helper.build_update_sql('tracked', 'tracked_id', 5n, {
			name: 'Sprocket',
			updated_at: Temporal.Instant.from('2026-01-02T03:04:05Z'),
		}),
		"UPDATE `tracked` SET `name` = 'Sprocket', `updated_at` = '2026-01-02 03:04:05' WHERE `tracked_id` = 5",
	)

	// An explicitly-undefined updated_at is skipped like any other column, so the automatic one applies.
	assert.strictEqual(
		helper.build_update_sql('tracked', 'tracked_id', 5n, { name: 'Sprocket', updated_at: undefined }),
		"UPDATE `tracked` SET `name` = 'Sprocket', `updated_at` = UTC_TIMESTAMP() WHERE `tracked_id` = 5",
	)

	const { connection, calls } = make_update_mock_connection()
	await helper.bulk_update(connection, 'tracked', 'tracked_id', [{ key: 1n, set: { name: 'a' } }], 10)
	assert.strictEqual(
		calls[0]!.sql,
		"UPDATE `tracked` SET `name` = 'a', `updated_at` = UTC_TIMESTAMP() WHERE `tracked_id` = 1",
	)
})

test('typed_write_helper: updates leave the SET clause alone on tables without an updated_at column', () => {
	const helper = make_helper()

	assert.strictEqual(
		helper.build_update_sql('widget', 'widget_id', 5n, { name: 'Sprocket' }),
		"UPDATE `widget` SET `name` = 'Sprocket' WHERE `widget_id` = 5",
	)
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
	const helper = typed_write_helper<SessionSchema, SessionRowSchema>(session_schema, session_insertable_schema)

	await helper.insert(connection, 'session', {
		employee_id: 1n,
		identifier: fns.uuid_to_bin('123e4567-e89b-12d3-a456-426614174000'),
		last_seen_at: fns.utc_timestamp(),
	})
	assert.strictEqual(
		calls[0]!.sql,
		"INSERT INTO `session` (`employee_id`, `identifier`, `last_seen_at`) VALUES (1, UUID_TO_BIN('123e4567-e89b-12d3-a456-426614174000'), UTC_TIMESTAMP())",
	)

	await helper.bulk_insert(connection, 'session', [{
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

	helper.insert(connection, 'session', {
		// @ts-expect-error: utc_timestamp claims Temporal.Instant, which is not assignable to a bigint column
		employee_id: fns.utc_timestamp(),
		identifier: fns.uuid_to_bin('123e4567-e89b-12d3-a456-426614174000'),
		last_seen_at: fns.utc_timestamp(),
	})
})
