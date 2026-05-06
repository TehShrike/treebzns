import { test } from 'node:test'
import * as assert from 'node:assert'
import { trustable_select_query_validator } from './trustable_select_query.ts'

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
	where: [{
		type: 'comparison',
		left: { type: 'column reference', table_identifier: 'project', column: 'client_id' },
		comparator: '=',
		right: { type: 'user provided value', value: 1 },
	}],
}

test('trustable_select_query validator: valid query', () => {
	assert.strictEqual(trustable_select_query_validator.is_valid(valid_query), true)
})

test('trustable_select_query validator: invalid comparator', () => {
	const query = {
		...valid_query,
		where: [{
			type: 'comparison',
			left: { type: 'column reference', table_identifier: 'project', column: 'client_id' },
			comparator: 'LIKE',
			right: { type: 'user provided value', value: 1 },
		}],
	}
	assert.strictEqual(trustable_select_query_validator.is_valid(query), false)
	console.log(trustable_select_query_validator.get_messages(query, 'query'))
})

test('trustable_select_query validator: invalid function name', () => {
	const query = {
		...valid_query,
		select: [{
			type: 'function',
			function: 'NOT_A_FUNCTION',
			arguments: [],
			alias: 'x',
		}],
	}
	assert.strictEqual(trustable_select_query_validator.is_valid(query), false)
	console.log(trustable_select_query_validator.get_messages(query, 'query'))
})

test('trustable_select_query validator: column reference missing column', () => {
	const query = {
		...valid_query,
		select: [{
			type: 'column reference',
			table_identifier: 'project',
		}],
	}
	assert.strictEqual(trustable_select_query_validator.is_valid(query), false)
	console.log(trustable_select_query_validator.get_messages(query, 'query'))
})

test('trustable_select_query validator: from is not an object', () => {
	const query = { ...valid_query, from: 'project' }
	assert.strictEqual(trustable_select_query_validator.is_valid(query), false)
	console.log(trustable_select_query_validator.get_messages(query, 'query'))
})

test('trustable_select_query validator: joins is not an array', () => {
	const query = { ...valid_query, joins: 'none' }
	assert.strictEqual(trustable_select_query_validator.is_valid(query), false)
	console.log(trustable_select_query_validator.get_messages(query, 'query'))
})
