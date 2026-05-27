import { test } from 'node:test'
import * as assert from 'node:assert'
import { safe_sql_query_validator } from './safe_sql_query_validator.ts'

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
}

test('safe_sql_query_validator: valid query', () => {
	assert.strictEqual(safe_sql_query_validator.is_valid(valid_query), true)
})

test('safe_sql_query_validator: invalid comparator', () => {
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
	assert.strictEqual(safe_sql_query_validator.is_valid(query), false)
	console.log(safe_sql_query_validator.get_messages(query, 'query'))
})

test('safe_sql_query_validator: invalid function name', () => {
	const query = {
		...valid_query,
		select: [{
			type: 'function',
			function: 'NOT_A_FUNCTION',
			arguments: [],
			alias: 'x',
		}],
	}
	assert.strictEqual(safe_sql_query_validator.is_valid(query), false)
	console.log(safe_sql_query_validator.get_messages(query, 'query'))
})

test('safe_sql_query_validator: column reference missing column', () => {
	const query = {
		...valid_query,
		select: [{
			type: 'column reference',
			table_identifier: 'project',
		}],
	}
	assert.strictEqual(safe_sql_query_validator.is_valid(query), false)
	console.log(safe_sql_query_validator.get_messages(query, 'query'))
})

test('safe_sql_query_validator: from is not an object', () => {
	const query = { ...valid_query, from: 'project' }
	assert.strictEqual(safe_sql_query_validator.is_valid(query), false)
	console.log(safe_sql_query_validator.get_messages(query, 'query'))
})

test('safe_sql_query_validator: joins is not an array', () => {
	const query = { ...valid_query, joins: 'none' }
	assert.strictEqual(safe_sql_query_validator.is_valid(query), false)
	console.log(safe_sql_query_validator.get_messages(query, 'query'))
})

test('safe_sql_query_validator: where AND grouping is valid', () => {
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
	assert.strictEqual(safe_sql_query_validator.is_valid(query), true)
})

test('safe_sql_query_validator: where OR grouping is valid', () => {
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
	assert.strictEqual(safe_sql_query_validator.is_valid(query), true)
})

test('safe_sql_query_validator: nested where grouping is valid', () => {
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
	assert.strictEqual(safe_sql_query_validator.is_valid(query), true)
})

test('safe_sql_query_validator: group_by array is valid', () => {
	const query = {
		...valid_query,
		group_by: [
			{ type: 'column reference', table_identifier: 'project', column: 'project_id' },
			{ type: 'column reference', table_identifier: 'project', column: 'company_id' },
		],
	}
	assert.strictEqual(safe_sql_query_validator.is_valid(query), true)
})

test('safe_sql_query_validator: select AND grouping is valid', () => {
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
	assert.strictEqual(safe_sql_query_validator.is_valid(query), true)
})

test('safe_sql_query_validator: select OR grouping is valid', () => {
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
	assert.strictEqual(safe_sql_query_validator.is_valid(query), true)
})
