import { test } from 'node:test'
import * as assert from 'node:assert'
import { make_safe_select_query_builder, type SafeSelectQuery } from './safe_select_query.ts'
import { type FinancialNumber } from 'financial-number'
import { type Temporal } from '@js-temporal/polyfill'
import typed_query_builder from './typed_query_builder.ts'
import { some } from '#shared/array.ts'

const test_schema = {
	project: {
		project_id: 'project_id',
		company_id: 'company_id',
		project_document_id: 'project_document_id',
		client_id: 'client_id',
		client_address_id: 'client_address_id',
		address_line_1: 'address_line_1',
		address_line_2: 'address_line_2',
		city: 'city',
		state: 'state',
		zip: 'zip',
		due_date: 'due_date',
		emergency: 'emergency',
		assigned_estimator_employee_id: 'assigned_estimator_employee_id',
		details: 'details',
		created_by_employee_id: 'created_by_employee_id',
		created_at: 'created_at',
		updated_at: 'updated_at',
		needs_client_approval: 'needs_client_approval',
		sent_for_client_approval: 'sent_for_client_approval',
		tax_rate_id: 'tax_rate_id',
		tax_rate: 'tax_rate',
		notes_for_crew: 'notes_for_crew',
		notes_for_office: 'notes_for_office',
		closed: 'closed',
		closed_at: 'closed_at',
		closed_date: 'closed_date',
	},
	project_line_item: {
		project_line_item_id: 'project_line_item_id',
		company_id: 'company_id',
		project_id: 'project_id',
		description: 'description',
		item_type_id: 'item_type_id',
		estimated_hours: 'estimated_hours',
		taxable: 'taxable',
		quantity: 'quantity',
		price: 'price',
		created_at: 'created_at',
		updated_at: 'updated_at',
	},
	client: {
		client_id: 'client_id',
		company_id: 'company_id',
		name: 'name',
		primary_client_address_id: 'primary_client_address_id',
		billing_client_address_id: 'billing_client_address_id',
		primary_phone: 'primary_phone',
		primary_email: 'primary_email',
		tax_rate_id: 'tax_rate_id',
		notes: 'notes',
		referred_by: 'referred_by',
		created_at: 'created_at',
		updated_at: 'updated_at',
	},
} as const

export type TestSchema = {
	project: {
		project_id: bigint
		company_id: bigint
		project_document_id: bigint
		client_id: bigint
		client_address_id: bigint
		address_line_1: string
		address_line_2: string | null
		city: string
		state: string
		zip: string
		due_date: Temporal.PlainDate | null
		emergency: boolean
		assigned_estimator_employee_id: bigint | null
		details: string | null
		created_by_employee_id: bigint
		created_at: Temporal.Instant
		updated_at: Temporal.Instant
		needs_client_approval: boolean
		sent_for_client_approval: boolean
		tax_rate_id: bigint | null
		tax_rate: FinancialNumber | null
		notes_for_crew: string | null
		notes_for_office: string | null
		closed: boolean
		closed_at: Temporal.Instant | null
		closed_date: Temporal.PlainDate | null
	}
	project_line_item: {
		project_line_item_id: bigint
		company_id: bigint
		project_id: bigint
		description: string | null
		item_type_id: bigint | null
		estimated_hours: bigint
		taxable: boolean
		quantity: FinancialNumber
		price: FinancialNumber
		created_at: Temporal.Instant
		updated_at: Temporal.Instant
	}
	client: {
		client_id: bigint
		company_id: bigint
		name: string
		primary_client_address_id: bigint
		billing_client_address_id: bigint
		primary_phone: string | null
		primary_email: string | null
		tax_rate_id: bigint | null
		notes: string | null
		referred_by: string | null
		created_at: Temporal.Instant
		updated_at: Temporal.Instant
	}
}



test('safe_select_query: valid query', () => {
	const valid_query = {
		select: [{
			type: 'column reference',
			table_identifier: 'p',
			column: 'project_id',
		}, {
			type: 'function',
			function: 'COUNT',
			arguments: [{
				type: 'column reference',
				table_identifier: 'p',
				column: 'project_id',
			}],
			alias: 'count_project_id',
			table_identifier: 'p',
		}],
		from: {
			table_name: 'project',
			alias: 'p',
		},
		joins: [{
			table_name: 'client',
			alias: 'c',
			on_clause: [{
				type: 'comparison',
				left: {
					type: 'column reference',
					table_identifier: 'p',
					column: 'client_id',
				},
				comparator: '=',
				right: {
					type: 'column reference',
					table_identifier: 'c',
					column: 'client_id',
				},
			}, {
				type: 'function',
				function: 'IS NOT NULL',
				arguments: [{
					type: 'column reference',
					table_identifier: 'p',
					column: 'client_id',
				}],
			}]
		}],
		where: {
			type: 'and',
			expressions: [{
				type: 'comparison',
				left: {
					type: 'column reference',
					table_identifier: 'p',
					column: 'client_id',
				},
				comparator: '=',
				right: {
					type: 'user provided value',
					value: 1,
				},
			}],
		},
		group_by: [{
			type: 'column reference',
			table_identifier: 'p',
			column: 'project_id',
		}],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names, to_sql } = make_safe_select_query_builder(test_schema)

	assert.strictEqual(validate_table_and_column_names(valid_query).valid, true)

	const { sql, values } = to_sql(valid_query)
	assert.strictEqual(sql, 'SELECT `p`.`project_id`, COUNT(`p`.`project_id`) AS `count_project_id`\nFROM `project` AS `p`\nJOIN `client` AS `c` ON `p`.`client_id` = `c`.`client_id`\n\tAND `p`.`client_id` IS NOT NULL\nWHERE `p`.`client_id` = ?\nGROUP BY `p`.`project_id`')
	assert.deepStrictEqual(values, [1])
})

test('safe_select_query: invalid table identifier in from', () => {
	const query = {
		select: [{
			type: 'column reference',
			table_identifier: 'project',
			column: 'project_id',
		}],
		from: {
			table_name: 'nonexistent_table',
			alias: 'project',
		},
		joins: [],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names } = make_safe_select_query_builder(test_schema)
	const result = validate_table_and_column_names(query)

	assert.strictEqual(result.valid, false)
	console.log(result.messages)
	assert.ok(some(result.messages, message => message.includes('nonexistent_table')))
})

test('safe_select_query: invalid table identifier in join', () => {
	const query = {
		select: [{
			type: 'column reference',
			table_identifier: 'project',
			column: 'project_id',
		}],
		from: {
			table_name: 'project',
			alias: 'project',
		},
		joins: [{
			table_name: 'nonexistent_table',
			alias: 'client',
			on_clause: [{
				type: 'comparison',
				left: {
					type: 'column reference',
					table_identifier: 'project',
					column: 'client_id',
				},
				comparator: '=',
				right: {
					type: 'column reference',
					table_identifier: 'client',
					column: 'client_id',
				},
			}]
		}],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names } = make_safe_select_query_builder(test_schema)
	const result = validate_table_and_column_names(query)

	assert.strictEqual(result.valid, false)
	console.log(result.messages)
	assert.ok(some(result.messages, message => message.includes('nonexistent_table')))
})

test('safe_select_query: invalid table identifier in select', () => {
	const query = {
		select: [{
			type: 'column reference',
			table_identifier: 'project',
			column: 'project_id',
		}],
		from: {
			table_name: 'project',
			alias: 'p',
		},
		joins: [],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names } = make_safe_select_query_builder(test_schema)
	const result = validate_table_and_column_names(query)

	assert.strictEqual(result.valid, false, 'project is not a valid table identifier, the correct alias is "p"')
	console.log(result.messages)
	assert.strictEqual(result.messages.length, 1)
})

test('safe_select_query: invalid table identifier in where', () => {
	const query = {
		select: [{
			type: 'function',
			function: 'COUNT',
			alias: 'cnt',
			table_identifier: 'p',
			arguments: [{
				type: 'user provided value',
				value: 1
			}]
		}],
		from: {
			table_name: 'project',
			alias: 'p',
		},
		joins: [],
		where: {
			type: 'and',
			expressions: [{
				type: 'comparison',
				left: {
					type: 'column reference',
					table_identifier: 'project',
					column: 'project_id'
				},
				comparator: '=',
				right: {
					type: 'user provided value',
					value: 1
				}
			}],
		},
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names } = make_safe_select_query_builder(test_schema)
	const result = validate_table_and_column_names(query)

	assert.strictEqual(result.valid, false, 'project is not a valid table identifier, the correct alias is "p"')
	console.log(result.messages)
	assert.strictEqual(result.messages.length, 1)
})

test('safe_select_query: invalid column in select', () => {
	const query = {
		select: [{
			type: 'column reference',
			table_identifier: 'project',
			column: 'nonexistent_column',
		}],
		from: {
			table_name: 'project',
			alias: 'project',
		},
		joins: [],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names } = make_safe_select_query_builder(test_schema)
	const result = validate_table_and_column_names(query)

	assert.strictEqual(result.valid, false)
	console.log(result.messages)
	assert.strictEqual(result.messages.length, 1)
})

test('safe_select_query: valid function in select', () => {
	const q = typed_query_builder<TestSchema>()
	const query = q.from('project AS p')
		.select(b => [
			'p.project_id',
			b.fn('COUNT', 'p.pcount'),
		])
		.build()

	const builder = make_safe_select_query_builder(test_schema)
	const { sql, values } = builder.to_sql(query.query)

	assert.strictEqual(sql, 'SELECT `p`.`project_id`, COUNT(*) AS `pcount`\nFROM `project` AS `p`')
	assert.deepStrictEqual(values, [])
})

test('safe_select_query: where AND grouping produces correct SQL', () => {
	const query = {
		select: [{ type: 'column reference', table_identifier: 'p', column: 'project_id' }],
		from: { table_name: 'project', alias: 'p' },
		joins: [],
		where: {
			type: 'and',
			expressions: [
				{
					type: 'comparison',
					left: { type: 'column reference', table_identifier: 'p', column: 'client_id' },
					comparator: '=',
					right: { type: 'user provided value', value: 1 },
				},
				{
					type: 'comparison',
					left: { type: 'column reference', table_identifier: 'p', column: 'closed' },
					comparator: '=',
					right: { type: 'user provided value', value: 0 },
				},
			],
		},
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names, to_sql } = make_safe_select_query_builder(test_schema)
	assert.strictEqual(validate_table_and_column_names(query).valid, true)

	const { sql, values } = to_sql(query)
	assert.strictEqual(sql, 'SELECT `p`.`project_id`\nFROM `project` AS `p`\nWHERE `p`.`client_id` = ?\n\tAND `p`.`closed` = ?')
	assert.deepStrictEqual(values, [1, 0])
})

test('safe_select_query: where OR grouping produces correct SQL', () => {
	const query = {
		select: [{ type: 'column reference', table_identifier: 'p', column: 'project_id' }],
		from: { table_name: 'project', alias: 'p' },
		joins: [],
		where: {
			type: 'or',
			expressions: [
				{
					type: 'comparison',
					left: { type: 'column reference', table_identifier: 'p', column: 'client_id' },
					comparator: '=',
					right: { type: 'user provided value', value: 1 },
				},
				{
					type: 'comparison',
					left: { type: 'column reference', table_identifier: 'p', column: 'closed' },
					comparator: '=',
					right: { type: 'user provided value', value: 0 },
				},
			],
		},
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names, to_sql } = make_safe_select_query_builder(test_schema)
	assert.strictEqual(validate_table_and_column_names(query).valid, true)

	const { sql, values } = to_sql(query)
	assert.strictEqual(sql, 'SELECT `p`.`project_id`\nFROM `project` AS `p`\nWHERE `p`.`client_id` = ?\n\tOR `p`.`closed` = ?')
	assert.deepStrictEqual(values, [1, 0])
})

test('safe_select_query: nested AND/OR in where produces parenthesized SQL', () => {
	const query = {
		select: [{ type: 'column reference', table_identifier: 'p', column: 'project_id' }],
		from: { table_name: 'project', alias: 'p' },
		joins: [],
		where: {
			type: 'and',
			expressions: [
				{
					type: 'or',
					expressions: [
						{
							type: 'comparison',
							left: { type: 'column reference', table_identifier: 'p', column: 'client_id' },
							comparator: '=',
							right: { type: 'user provided value', value: 1 },
						},
						{
							type: 'comparison',
							left: { type: 'column reference', table_identifier: 'p', column: 'closed' },
							comparator: '=',
							right: { type: 'user provided value', value: 0 },
						},
					],
				},
				{
					type: 'comparison',
					left: { type: 'column reference', table_identifier: 'p', column: 'company_id' },
					comparator: '=',
					right: { type: 'user provided value', value: 5 },
				},
			],
		},
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names, to_sql } = make_safe_select_query_builder(test_schema)
	assert.strictEqual(validate_table_and_column_names(query).valid, true)

	const { sql, values } = to_sql(query)
	assert.strictEqual(sql, 'SELECT `p`.`project_id`\nFROM `project` AS `p`\nWHERE (`p`.`client_id` = ? OR `p`.`closed` = ?)\n\tAND `p`.`company_id` = ?')
	assert.deepStrictEqual(values, [1, 0, 5])
})

test('safe_select_query: group_by array produces correct SQL', () => {
	const query = {
		select: [{ type: 'column reference', table_identifier: 'p', column: 'project_id' }],
		from: { table_name: 'project', alias: 'p' },
		joins: [],
		where: null,
		group_by: [
			{ type: 'column reference', table_identifier: 'p', column: 'project_id' },
			{ type: 'column reference', table_identifier: 'p', column: 'company_id' },
		],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names, to_sql } = make_safe_select_query_builder(test_schema)
	assert.strictEqual(validate_table_and_column_names(query).valid, true)

	const { sql } = to_sql(query)
	assert.strictEqual(sql, 'SELECT `p`.`project_id`\nFROM `project` AS `p`\nGROUP BY `p`.`project_id`, `p`.`company_id`')
})

test('safe_select_query: group_by with function expression must not emit AS alias', () => {
	const query = {
		select: [{ type: 'column reference', table_identifier: 'p', column: 'project_id' }],
		from: { table_name: 'project', alias: 'p' },
		joins: [],
		where: null,
		group_by: [{
			type: 'function',
			function: 'COUNT',
			arguments: [{ type: 'column reference', table_identifier: 'p', column: 'project_id' }],
			alias: 'pcount',
			table_identifier: 'p',
		}],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { to_sql } = make_safe_select_query_builder(test_schema)
	const { sql } = to_sql(query)

	// MySQL rejects `GROUP BY <expr> AS <alias>` — the alias only belongs in SELECT.
	assert.strictEqual(sql, 'SELECT `p`.`project_id`\nFROM `project` AS `p`\nGROUP BY COUNT(`p`.`project_id`)')
})

test('safe_select_query: select AND grouping produces correct SQL', () => {
	const query = {
		select: [
			{ type: 'column reference', table_identifier: 'p', column: 'project_id' },
			{
				type: 'and',
				expressions: [
					{ type: 'column reference', table_identifier: 'p', column: 'closed' },
					{ type: 'column reference', table_identifier: 'p', column: 'emergency' },
				],
			},
		],
		from: { table_name: 'project', alias: 'p' },
		joins: [],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names, to_sql } = make_safe_select_query_builder(test_schema)
	assert.strictEqual(validate_table_and_column_names(query).valid, true)

	const { sql, values } = to_sql(query)
	assert.strictEqual(sql, 'SELECT `p`.`project_id`, (`p`.`closed` AND `p`.`emergency`)\nFROM `project` AS `p`')
	assert.deepStrictEqual(values, [])
})

test('safe_select_query: select OR grouping produces correct SQL', () => {
	const query = {
		select: [
			{ type: 'column reference', table_identifier: 'p', column: 'project_id' },
			{
				type: 'or',
				expressions: [
					{ type: 'column reference', table_identifier: 'p', column: 'closed' },
					{ type: 'column reference', table_identifier: 'p', column: 'emergency' },
				],
			},
		],
		from: { table_name: 'project', alias: 'p' },
		joins: [],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names, to_sql } = make_safe_select_query_builder(test_schema)
	assert.strictEqual(validate_table_and_column_names(query).valid, true)

	const { sql, values } = to_sql(query)
	assert.strictEqual(sql, 'SELECT `p`.`project_id`, (`p`.`closed` OR `p`.`emergency`)\nFROM `project` AS `p`')
	assert.deepStrictEqual(values, [])
})

test('safe_select_query: order_by and limit produce correct SQL', () => {
	const q = typed_query_builder<TestSchema>()
	const query = q.from('project AS p')
		.select(() => ['p.project_id'])
		.order_by('p.created_at')
		.order_by('p.project_id', 'DESC')
		.limit(5n)
		.build()

	const { to_sql } = make_safe_select_query_builder(test_schema)
	const { sql, values } = to_sql(query.query)

	assert.strictEqual(sql, 'SELECT `p`.`project_id`\nFROM `project` AS `p`\nORDER BY `p`.`created_at` ASC, `p`.`project_id` DESC\nLIMIT 5')
	assert.deepStrictEqual(values, [])
})

test('safe_select_query: order_by / having alias references must name a select alias', () => {
	const { validate_table_and_column_names } = make_safe_select_query_builder(test_schema)

	const base = {
		select: [{ type: 'column reference', table_identifier: 'p', column: 'project_id', alias: 'pid' }],
		from: { table_name: 'project', alias: 'p' },
		joins: [],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	// referencing the selected alias is valid
	assert.strictEqual(validate_table_and_column_names({
		...base,
		order_by: [{ expression: { type: 'alias reference', alias: 'pid' }, direction: 'ASC' }],
	}).valid, true)

	// referencing an alias the select does not produce is invalid
	const bad = validate_table_and_column_names({
		...base,
		having: {
			type: 'and',
			expressions: [
				{ type: 'comparison', left: { type: 'alias reference', alias: 'nope' }, comparator: '>', right: { type: 'user provided value', value: 1 } },
			],
		},
	})
	assert.strictEqual(bad.valid, false)
	assert.ok(bad.valid === false && some(bad.messages, m => m.includes('nope')))
})

test('safe_select_query: order_by by alias and inline function, plus having on an alias', () => {
	const q = typed_query_builder<TestSchema>()
	const query = q.from('project AS p')
		.join('project_line_item AS pli', on => on.comparison('pli.project_id', '=', 'p.project_id'))
		.select(b => ['p.project_id', b.fn('COUNT', 'pli.project_line_item_id', 'pli.line_count')])
		.group_by('p.project_id')
		.having(b => b.comparison('line_count', '>=', { value: 2 }))
		.order_by('line_count', 'DESC')
		.order_by(b => b.fn('COUNT', 'pli.project_line_item_id'))
		.build()

	const { to_sql } = make_safe_select_query_builder(test_schema)
	const { sql, values } = to_sql(query.query)

	assert.strictEqual(sql, 'SELECT `p`.`project_id`, COUNT(`pli`.`project_line_item_id`) AS `line_count`\nFROM `project` AS `p`\nJOIN `project_line_item` AS `pli` ON `pli`.`project_id` = `p`.`project_id`\nGROUP BY `p`.`project_id`\nHAVING `line_count` >= ?\nORDER BY `line_count` DESC, COUNT(`pli`.`project_line_item_id`) ASC')
	assert.deepStrictEqual(values, [2])
})

test('safe_select_query: where OR grouping with nested AND', () => {
	const query = {
		select: [{ type: 'column reference', table_identifier: 'p', column: 'project_id' }],
		from: { table_name: 'project', alias: 'p' },
		joins: [],
		where: {
			type: 'or',
			expressions: [
				{
					type: 'comparison',
					left: { type: 'column reference', table_identifier: 'p', column: 'client_id' },
					comparator: '=',
					right: { type: 'user provided value', value: 1 },
				},
				{
					type: 'and',
					expressions: [{
						type: 'comparison',
						left: { type: 'column reference', table_identifier: 'p', column: 'closed' },
						comparator: '=',
						right: { type: 'user provided value', value: 0 },
					}, {
						type: 'comparison',
						left: { type: 'column reference', table_identifier: 'p', column: 'emergency' },
						comparator: '=',
						right: { type: 'user provided value', value: 1 },
					}]
				},
			],
		},
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	} satisfies SafeSelectQuery

	const { validate_table_and_column_names, to_sql } = make_safe_select_query_builder(test_schema)
	assert.strictEqual(validate_table_and_column_names(query).valid, true)

	const { sql, values } = to_sql(query)
	assert.strictEqual(sql, 'SELECT `p`.`project_id`\nFROM `project` AS `p`\nWHERE `p`.`client_id` = ?\n\tOR (`p`.`closed` = ? AND `p`.`emergency` = ?)')
	assert.deepStrictEqual(values, [1, 0, 1])
})

test('the column whitelist argument typechecks column names against the table', () => {
	// Valid table + valid columns: accepted.
	make_safe_select_query_builder(test_schema, {
		project: ['project_id', 'company_id'],
		client: ['client_id', 'name'],
	})

	// @ts-expect-error - "not_a_real_column" is not a column of the project table
	make_safe_select_query_builder(test_schema, { project: ['project_id', 'not_a_real_column'] })

	// @ts-expect-error - "name" exists on client/permission but not on project
	make_safe_select_query_builder(test_schema, { project: ['name'] })

	// @ts-expect-error - "not_a_real_table" is not a table in the schema
	make_safe_select_query_builder(test_schema, { not_a_real_table: ['project_id'] })
})

test('safe_select_query: left join renders LEFT JOIN', () => {
	const q = typed_query_builder<TestSchema>()
	const query = q.from('project AS p')
		.left_join('client AS c', on => on.comparison('p.client_id', '=', 'c.client_id'))
		.select(() => ['p.project_id', 'c.name'])
		.build()

	const { to_sql } = make_safe_select_query_builder(test_schema)
	const { sql, values } = to_sql(query.query)

	assert.strictEqual(sql, 'SELECT `p`.`project_id`, `c`.`name`\nFROM `project` AS `p`\nLEFT JOIN `client` AS `c` ON `p`.`client_id` = `c`.`client_id`')
	assert.deepStrictEqual(values, [])
})

const top_clients_subquery = {
	select: [
		{ type: 'column reference', table_identifier: 'c', column: 'client_id' },
		{ type: 'column reference', table_identifier: 'c', column: 'name', alias: 'client_name' },
	],
	from: { table_name: 'client', alias: 'c' },
	joins: [],
	where: {
		type: 'and',
		expressions: [{
			type: 'comparison',
			left: { type: 'column reference', table_identifier: 'c', column: 'company_id' },
			comparator: '=',
			right: { type: 'user provided value', value: 7 },
		}],
	},
	group_by: [],
	order_by: [{ expression: { type: 'column reference', table_identifier: 'c', column: 'name' }, direction: 'ASC' }],
	limit: 2n,
	having: null,
} satisfies SafeSelectQuery

const derived_table_query = (overrides: Partial<SafeSelectQuery>): SafeSelectQuery => ({
	select: [
		{ type: 'column reference', table_identifier: 'p', column: 'project_id' },
		{ type: 'column reference', table_identifier: 'top', column: 'client_name' },
	],
	from: { subquery: top_clients_subquery, alias: 'top' },
	joins: [{
		table_name: 'project',
		alias: 'p',
		on_clause: [{
			type: 'comparison',
			left: { type: 'column reference', table_identifier: 'p', column: 'client_id' },
			comparator: '=',
			right: { type: 'column reference', table_identifier: 'top', column: 'client_id' },
		}],
	}],
	where: {
		type: 'and',
		expressions: [{
			type: 'comparison',
			left: { type: 'column reference', table_identifier: 'p', column: 'closed' },
			comparator: '=',
			right: { type: 'user provided value', value: false },
		}],
	},
	group_by: [],
	order_by: [],
	limit: null,
	having: null,
	...overrides,
})

test('safe_select_query: derived table in from', () => {
	const query = derived_table_query({})
	const { validate_table_and_column_names, to_sql } = make_safe_select_query_builder(test_schema)

	assert.strictEqual(validate_table_and_column_names(query).valid, true)

	const { sql, values } = to_sql(query)
	assert.strictEqual(sql, [
		'SELECT `p`.`project_id`, `top`.`client_name`',
		'FROM (',
		'\tSELECT `c`.`client_id`, `c`.`name` AS `client_name`',
		'\tFROM `client` AS `c`',
		'\tWHERE `c`.`company_id` = ?',
		'\tORDER BY `c`.`name` ASC',
		'\tLIMIT 2',
		') AS `top`',
		'JOIN `project` AS `p` ON `p`.`client_id` = `top`.`client_id`',
		'WHERE `p`.`closed` = ?',
	].join('\n'))
	assert.deepStrictEqual(values, [7, false])
})

test('safe_select_query: derived table exposes only the identifiers its subquery selects', () => {
	const query = derived_table_query({
		select: [{ type: 'column reference', table_identifier: 'top', column: 'notes' }],
	})
	const { validate_table_and_column_names } = make_safe_select_query_builder(test_schema)
	const result = validate_table_and_column_names(query)

	assert.strictEqual(result.valid, false)
	assert.ok(some(result.messages, message => message.includes('notes')))
})

test('safe_select_query: derived table with duplicate output identifiers is invalid', () => {
	const query = derived_table_query({
		from: {
			subquery: {
				...top_clients_subquery,
				select: [
					{ type: 'column reference', table_identifier: 'c', column: 'client_id' },
					{ type: 'column reference', table_identifier: 'c', column: 'name', alias: 'client_id' },
				],
			},
			alias: 'top',
		},
	})
	const { validate_table_and_column_names } = make_safe_select_query_builder(test_schema)
	const result = validate_table_and_column_names(query)

	assert.strictEqual(result.valid, false)
	assert.ok(some(result.messages, message => message.includes('Duplicate column "client_id"')))
})

test('safe_select_query: problems inside the derived table subquery are reported', () => {
	const query = derived_table_query({
		from: {
			subquery: {
				...top_clients_subquery,
				select: [{ type: 'column reference', table_identifier: 'c', column: 'nonexistent_column' }],
			},
			alias: 'top',
		},
		select: [{ type: 'column reference', table_identifier: 'p', column: 'project_id' }],
	})
	const { validate_table_and_column_names } = make_safe_select_query_builder(test_schema)
	const result = validate_table_and_column_names(query)

	assert.strictEqual(result.valid, false)
	assert.ok(some(result.messages, message => message.includes('nonexistent_column')))
})
