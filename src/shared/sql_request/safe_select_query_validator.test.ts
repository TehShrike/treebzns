import { test } from 'node:test'
import * as assert from 'node:assert'
import { safe_select_query_validator } from './safe_select_query_validator.ts'

const valid_query = {
	select: [{
		type: 'column reference',
		table_identifier: 'project',
		column: 'project_id',
	}, {
		type: 'function',
		function: 'COUNT',
		arguments: [{
			type: 'column reference',
			table_identifier: 'project',
			column: 'project_id',
		}],
		alias: 'count_project_id',
		table_identifier: 'project',
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
			left: { type: 'column reference', table_identifier: 'project', column: 'client_id' },
			comparator: '=',
			right: { type: 'column reference', table_identifier: 'client', column: 'client_id' },
		}, {
			type: 'function',
			function: 'IS NOT NULL',
			arguments: [{ type: 'column reference', table_identifier: 'project', column: 'client_id' }],
		}],
	}],
	where: {
		type: 'and',
		expressions: [{
			type: 'comparison',
			left: { type: 'column reference', table_identifier: 'project', column: 'client_id' },
			comparator: '=',
			right: { type: 'user provided value', value: 1 },
		}],
	},
	group_by: [],
	order_by: [],
	limit: null,
	having: null,
}

test('safe_select_query_validator: valid query', () => {
	assert.strictEqual(safe_select_query_validator.is_valid(valid_query), true)
})

test('safe_select_query_validator: invalid comparator', () => {
	const query = {
		...valid_query,
		where: {
			type: 'and',
			expressions: [{
				type: 'comparison',
				left: { type: 'column reference', table_identifier: 'project', column: 'client_id' },
				comparator: 'LIKE',
				right: { type: 'user provided value', value: 1 },
			}],
		},
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
	console.log(safe_select_query_validator.get_messages(query, 'query'))
})

test('safe_select_query_validator: invalid function name', () => {
	const query = {
		...valid_query,
		select: [{
			type: 'function',
			function: 'NOT_A_FUNCTION',
			arguments: [],
			alias: 'x',
		}],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
	console.log(safe_select_query_validator.get_messages(query, 'query'))
})

test('safe_select_query_validator: column reference missing column', () => {
	const query = {
		...valid_query,
		select: [{
			type: 'column reference',
			table_identifier: 'project',
		}],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
	console.log(safe_select_query_validator.get_messages(query, 'query'))
})

test('safe_select_query_validator: from is not an object', () => {
	const query = { ...valid_query, from: 'project' }
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
	console.log(safe_select_query_validator.get_messages(query, 'query'))
})

test('safe_select_query_validator: joins is not an array', () => {
	const query = { ...valid_query, joins: 'none' }
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
	console.log(safe_select_query_validator.get_messages(query, 'query'))
})

test('safe_select_query_validator: where AND grouping is valid', () => {
	const query = {
		...valid_query,
		where: {
			type: 'and',
			expressions: [
				{
					type: 'comparison',
					left: { type: 'column reference', table_identifier: 'project', column: 'client_id' },
					comparator: '=',
					right: { type: 'user provided value', value: 1 },
				},
				{
					type: 'comparison',
					left: { type: 'column reference', table_identifier: 'project', column: 'closed' },
					comparator: '=',
					right: { type: 'user provided value', value: 0 },
				},
			],
		},
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), true)
})

test('safe_select_query_validator: where OR grouping is valid', () => {
	const query = {
		...valid_query,
		where: {
			type: 'or',
			expressions: [
				{
					type: 'comparison',
					left: { type: 'column reference', table_identifier: 'project', column: 'client_id' },
					comparator: '=',
					right: { type: 'user provided value', value: 1 },
				},
				{
					type: 'comparison',
					left: { type: 'column reference', table_identifier: 'project', column: 'closed' },
					comparator: '=',
					right: { type: 'user provided value', value: 0 },
				},
			],
		},
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), true)
})

test('safe_select_query_validator: nested where grouping is valid', () => {
	const query = {
		...valid_query,
		where: {
			type: 'and',
			expressions: [
				{
					type: 'or',
					expressions: [
						{
							type: 'comparison',
							left: { type: 'column reference', table_identifier: 'project', column: 'client_id' },
							comparator: '=',
							right: { type: 'user provided value', value: 1 },
						},
						{
							type: 'comparison',
							left: { type: 'column reference', table_identifier: 'project', column: 'closed' },
							comparator: '=',
							right: { type: 'user provided value', value: 0 },
						},
					],
				},
				{
					type: 'comparison',
					left: { type: 'column reference', table_identifier: 'project', column: 'company_id' },
					comparator: '=',
					right: { type: 'user provided value', value: 5 },
				},
			],
		},
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), true)
})

test('safe_select_query_validator: group_by array is valid', () => {
	const query = {
		...valid_query,
		group_by: [
			{ type: 'column reference', table_identifier: 'project', column: 'project_id' },
			{ type: 'column reference', table_identifier: 'project', column: 'company_id' },
		],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), true)
})

test('safe_select_query_validator: select AND grouping is valid', () => {
	const query = {
		...valid_query,
		select: [
			{ type: 'column reference', table_identifier: 'project', column: 'project_id' },
			{
				type: 'and',
				expressions: [
					{ type: 'column reference', table_identifier: 'project', column: 'closed' },
					{ type: 'column reference', table_identifier: 'project', column: 'emergency' },
				],
			},
		],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), true)
})

test('safe_select_query_validator: positive bigint limit is valid', () => {
	assert.strictEqual(safe_select_query_validator.is_valid({ ...valid_query, limit: 5n }), true)
})

test('safe_select_query_validator: null limit is valid', () => {
	assert.strictEqual(safe_select_query_validator.is_valid({ ...valid_query, limit: null }), true)
})

test('safe_select_query_validator: zero limit is invalid', () => {
	assert.strictEqual(safe_select_query_validator.is_valid({ ...valid_query, limit: 0n }), false)
})

test('safe_select_query_validator: negative limit is invalid', () => {
	assert.strictEqual(safe_select_query_validator.is_valid({ ...valid_query, limit: -1n }), false)
})

test('safe_select_query_validator: number limit is invalid', () => {
	assert.strictEqual(safe_select_query_validator.is_valid({ ...valid_query, limit: 5 }), false)
})

test('safe_select_query_validator: order_by with descending direction is valid', () => {
	const query = {
		...valid_query,
		order_by: [
			{ expression: { type: 'column reference', table_identifier: 'project', column: 'project_id' }, direction: 'DESC' },
		],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), true)
})

test('safe_select_query_validator: order_by by alias reference is valid', () => {
	const query = {
		...valid_query,
		order_by: [{ expression: { type: 'alias reference', alias: 'total' }, direction: 'ASC' }],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), true)
})

test('safe_select_query_validator: having with alias references is valid', () => {
	const query = {
		...valid_query,
		having: {
			type: 'and',
			expressions: [
				{ type: 'comparison', left: { type: 'alias reference', alias: 'total' }, comparator: '>', right: { type: 'user provided value', value: 5 } },
			],
		},
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), true)
})

test('safe_select_query_validator: having with a column reference operand is invalid', () => {
	const query = {
		...valid_query,
		having: {
			type: 'and',
			expressions: [
				{ type: 'comparison', left: { type: 'column reference', table_identifier: 'p', column: 'project_id' }, comparator: '>', right: { type: 'user provided value', value: 5 } },
			],
		},
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
})

test('safe_select_query_validator: order_by with invalid direction is invalid', () => {
	const query = {
		...valid_query,
		order_by: [
			{ expression: { type: 'column reference', table_identifier: 'project', column: 'project_id' }, direction: 'SIDEWAYS' },
		],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
})

test('safe_select_query_validator: backtick in select column alias is invalid', () => {
	const query = {
		...valid_query,
		select: [{
			type: 'column reference',
			table_identifier: 'project',
			column: 'project_id',
			alias: 'n`, (SELECT identifier FROM employee_session LIMIT 1) AS `leak',
		}],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
})

test('safe_select_query_validator: backtick in from alias is invalid', () => {
	const query = { ...valid_query, from: { table_name: 'project', alias: 'p` UNION SELECT' } }
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
})

test('safe_select_query_validator: backtick in join alias is invalid', () => {
	const query = {
		...valid_query,
		joins: [{ ...valid_query.joins[0], alias: 'c`; DROP TABLE employee' }],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
})

test('safe_select_query_validator: backtick in alias reference (order_by) is invalid', () => {
	const query = {
		...valid_query,
		order_by: [{ expression: { type: 'alias reference', alias: 'total`, x' }, direction: 'ASC' }],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
})

test('safe_select_query_validator: backtick in having alias reference is invalid', () => {
	const query = {
		...valid_query,
		having: {
			type: 'and',
			expressions: [
				{ type: 'comparison', left: { type: 'alias reference', alias: 'total`)--' }, comparator: '>', right: { type: 'user provided value', value: 5 } },
			],
		},
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
})

test('safe_select_query_validator: select function alias with backtick is invalid', () => {
	const query = {
		...valid_query,
		select: [{
			type: 'function',
			function: 'COUNT',
			arguments: [{ type: 'column reference', table_identifier: 'project', column: 'project_id' }],
			alias: 'c`, secret',
			table_identifier: 'project',
		}],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
})

test('safe_select_query_validator: select OR grouping is valid', () => {
	const query = {
		...valid_query,
		select: [
			{ type: 'column reference', table_identifier: 'project', column: 'project_id' },
			{
				type: 'or',
				expressions: [
					{ type: 'column reference', table_identifier: 'project', column: 'closed' },
					{ type: 'column reference', table_identifier: 'project', column: 'emergency' },
				],
			},
		],
	}
	assert.strictEqual(safe_select_query_validator.is_valid(query), true)
})

test('safe_select_query_validator: join left flag accepts booleans', () => {
	const with_left = (left: unknown) => ({
		...valid_query,
		joins: [{ ...valid_query.joins[0], left }],
	})
	assert.strictEqual(safe_select_query_validator.is_valid(with_left(true)), true)
	assert.strictEqual(safe_select_query_validator.is_valid(with_left(false)), true)
})

test('safe_select_query_validator: join left flag rejects non-booleans', () => {
	const with_left = (left: unknown) => ({
		...valid_query,
		joins: [{ ...valid_query.joins[0], left }],
	})
	assert.strictEqual(safe_select_query_validator.is_valid(with_left('LEFT')), false)
	assert.strictEqual(safe_select_query_validator.is_valid(with_left(1)), false)
	assert.strictEqual(safe_select_query_validator.is_valid(with_left(null)), false)
})

test('safe_select_query_validator: from may be a derived table', () => {
	const query = { ...valid_query, from: { subquery: valid_query, alias: 'derived' } }
	assert.strictEqual(safe_select_query_validator.is_valid(query), true)
})

test('safe_select_query_validator: derived table alias must be an identifier', () => {
	const query = { ...valid_query, from: { subquery: valid_query, alias: 'd` UNION SELECT' } }
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
})

test('safe_select_query_validator: derived table subquery is validated', () => {
	const query = { ...valid_query, from: { subquery: { ...valid_query, from: 'project' }, alias: 'derived' } }
	assert.strictEqual(safe_select_query_validator.is_valid(query), false)
})
