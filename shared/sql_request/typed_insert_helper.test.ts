import { test } from 'node:test'
import * as assert from 'node:assert'
import type { Connection } from 'mysql2/promise'
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

const make_mock_connection = () => {
	const calls: Array<{ sql: string; values: unknown[] }> = []
	const connection = {
		query: (sql: string, values: unknown[]) => {
			calls.push({ sql, values })
			return Promise.resolve([[], []])
		},
	} as unknown as Connection
	return { connection, calls }
}

test('typed_insert_helper: schema constants must cover every insertable table and column', () => {
	// test_schema includes all of TestSchema's tables/columns (plus extras), so this is allowed.
	typed_insert_helper<TestSchema>(test_schema)

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
	typed_insert_helper<TestSchema>(missing_name)

	const widget_only = {
		widget: test_schema.widget,
	} as const
	// @ts-expect-error: missing the entire 'gadget' table
	typed_insert_helper<TestSchema>(widget_only)
})

test('typed_insert_helper: insert enforces column names and value types', () => {
	const { connection } = make_mock_connection()
	const helper = typed_insert_helper<TestSchema>(test_schema)

	helper.insert(connection, 'widget', { company_id: 1n, name: 'Sprocket', description: null })
	helper.insert(connection, 'widget', { company_id: 1n, name: 'Sprocket', description: 'a description' })
	helper.insert(connection, 'gadget', { company_id: 1n, widget_id: 2n, quantity: 3n })

	// @ts-expect-error: company_id must be a bigint
	helper.insert(connection, 'widget', { company_id: 'not a bigint', name: 'x', description: null })

	// @ts-expect-error: 'name' is a required column
	helper.insert(connection, 'widget', { company_id: 1n, description: null })

	assert.throws(() => {
		// @ts-expect-error: 'sprockets' is not a column on widget
		helper.insert(connection, 'widget', { company_id: 1n, name: 'x', description: null, sprockets: 1n })
	})

	assert.throws(() => {
		// @ts-expect-error: 'not_a_table' is not a table in TestSchema
		helper.insert(connection, 'not_a_table', {})
	})
})

test('typed_insert_helper: insert builds a parameterized INSERT statement', async () => {
	const { connection, calls } = make_mock_connection()
	const helper = typed_insert_helper<TestSchema>(test_schema)

	await helper.insert(connection, 'widget', { company_id: 7n, name: 'Sprocket', description: null })

	assert.strictEqual(calls.length, 1)
	assert.strictEqual(
		calls[0]!.sql,
		'INSERT INTO `widget` (`company_id`, `name`, `description`) VALUES (?, ?, ?)',
	)
	assert.deepStrictEqual(calls[0]!.values, [7n, 'Sprocket', null])
})
