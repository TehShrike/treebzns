import { test } from 'node:test'
import type { FinancialNumber } from 'financial-number'
import { Temporal } from '@js-temporal/polyfill'
import query_builder, { type ExtractQueryResponse, type BuiltQuery, type SelectedIdentifiers } from './typed_query_builder.ts'

type AssertEqual<A, B> =
	(<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
import { make_safe_select_query_builder } from './safe_select_query.ts'
import * as assert from 'node:assert'
import {safe_select_query_validator} from './safe_select_query_validator.ts'

type ExampleProject = {
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

type ExampleProjectDocument = {
	project_document_id: bigint
	company_id: bigint
	group_name: string
	name: string
	needs_estimate_to_move_on: boolean
	needs_client_approval_to_move_on: boolean
	can_expire: boolean
	expire_days: bigint | null
	next_project_document_id: bigint | null
	should_be_worked: boolean
	needs_to_be_contacted_by_lead_qualifier: boolean
	can_be_closed: boolean
	represents_billable_sale_when_closed: boolean
	created_at: Temporal.Instant
	updated_at: Temporal.Instant
}

type ExampleProjectLineItem = {
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

type ExampleSchema = {
	project: ExampleProject
	project_document: ExampleProjectDocument
	project_line_item: ExampleProjectLineItem
}

// used for assertions, not relevant to the type
const example_schema = {
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
	project_document: {
		project_document_id: 'project_document_id',
		company_id: 'company_id',
		group_name: 'group_name',
		name: 'name',
		needs_estimate_to_move_on: 'needs_estimate_to_move_on',
		needs_client_approval_to_move_on: 'needs_client_approval_to_move_on',
		can_expire: 'can_expire',
		expire_days: 'expire_days',
		next_project_document_id: 'next_project_document_id',
		should_be_worked: 'should_be_worked',
		needs_to_be_contacted_by_lead_qualifier: 'needs_to_be_contacted_by_lead_qualifier',
		can_be_closed: 'can_be_closed',
		represents_billable_sale_when_closed: 'represents_billable_sale_when_closed',
		created_at: 'created_at',
		updated_at: 'updated_at',
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
} as const

const safe_select_query_builder = make_safe_select_query_builder(example_schema)
function assert_valid_query_output(built: BuiltQuery<unknown>) {
	const query_is_safe = safe_select_query_validator.is_valid(built.query)
	if (!query_is_safe) {
		console.log(safe_select_query_validator.get_messages(built.query, 'query'))
	}
	assert.strictEqual(query_is_safe, true)

	const validity = safe_select_query_builder.validate_table_and_column_names(built.query)
	if (!validity.valid) {
		console.log(validity.messages)
	}
	assert.strictEqual(validity.valid, true)
}


const q = query_builder<ExampleSchema>()

test('typed_query_builder: from with valid table', () => {
	const built = q.from('project AS projectz').build()
	assert_valid_query_output(built)
})

test('typed_query_builder: chained joins with column refs by alias', () => {
	const built = q.from('project AS p')
		.join('project_line_item AS pli', on => on.comparison('pli.project_id', '=', 'p.project_id'))
		.join('project_document AS pd', on => on.comparison('p.project_document_id', '=', 'pd.project_document_id'))
		.build()
	assert_valid_query_output(built)
})

test('typed_query_builder: where with column ref against value', () => {
	const built = q.from('project_line_item AS pli')
		.where(q => q.comparison('pli.project_id', '=', { value: 2 }))
		.build()
	assert_valid_query_output(built)
})

test('typed_query_builder: where after join with and', () => {
	const built = q.from('project AS p')
		.join('project_line_item AS pli', on => on.comparison('pli.project_id', '=', 'p.project_id'))
		.where(q => q.and(
			q.comparison('pli.item_type_id', '=', { value: 3 }),
			q.comparison('p.company_id', '=', { value: 4 }),
		))
		.build()
	assert_valid_query_output(built)
})

test('typed_query_builder: select with column refs and aliases', () => {
	const built = q.from('project AS p')
		.select(() => [
			'p.project_id',
			'p.company_id AS co',
		])
		.build()

	type ExpectedRowType = {
		p: {
			project_id: bigint
			co: bigint
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	assert.deepStrictEqual(built.response_columns, [
		{ table_identifier: 'p', name: 'project_id' },
		{ table_identifier: 'p', name: 'co' },
	])

	assert_valid_query_output(built)
})

test('typed_query_builder: select single column without alias', () => {
	const built = q.from('project AS p')
		.select(() => ['p.project_id'])
		.build()

	type ExpectedRowType = {
		p: {
			project_id: bigint
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	assert.deepStrictEqual(built.response_columns, [
		{ table_identifier: 'p', name: 'project_id' },
	])

	assert_valid_query_output(built)
})

test('typed_query_builder: select across multiple tables via join', () => {
	const built = q.from('project AS p')
		.join('project_line_item AS pli', on => on.comparison('pli.project_id', '=', 'p.project_id'))
		.select(() => [
			'p.project_id',
			'pli.project_line_item_id',
			'pli.price AS unit_price',
		])
		.build()

	type ExpectedRowType = {
		p: {
			project_id: bigint
		}
		pli: {
			project_line_item_id: bigint
			unit_price: FinancialNumber
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	assert.deepStrictEqual(built.response_columns, [
		{ table_identifier: 'p', name: 'project_id' },
		{ table_identifier: 'pli', name: 'project_line_item_id' },
		{ table_identifier: 'pli', name: 'unit_price' },
	])

	assert_valid_query_output(built)
})

test('typed_query_builder: select with COUNT function', () => {
	const built = q.from('project AS p')
		.select(b => [
			'p.project_id',
			b.fn('COUNT', 'p.pcount'),
		])
		.build()

	type ExpectedRowType = {
		p: {
			project_id: bigint
			pcount: bigint
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	assert.deepStrictEqual(built.response_columns, [
		{ table_identifier: 'p', name: 'project_id' },
		{ table_identifier: 'p', name: 'pcount' },
	])

	assert_valid_query_output(built)
})

test('typed_query_builder: select with aggregate functions', () => {
	const built = q.from('project AS p')
		.select(b => [
			b.fn('MAX', 'p.due_date', 'p.max_due_date'),
			b.fn('MIN', 'p.project_id', 'p.min_project_id'),
			b.fn('SUM', 'p.created_by_employee_id', 'p.hours_sum'),
			b.fn('AVG', 'p.tax_rate', 'p.avg_tax'),
		])
		.build()

	type ExpectedRowType = {
		p: {
			max_due_date: Temporal.PlainDate | null
			min_project_id: bigint | null
			hours_sum: FinancialNumber | null
			avg_tax: FinancialNumber | null
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	const { sql, values } = safe_select_query_builder.to_sql(built.query)
	assert.strictEqual(sql, 'SELECT MAX(`p`.`due_date`) AS `max_due_date`, MIN(`p`.`project_id`) AS `min_project_id`, SUM(`p`.`created_by_employee_id`) AS `hours_sum`, AVG(`p`.`tax_rate`) AS `avg_tax`\nFROM `project` AS `p`')
	assert.deepStrictEqual(values, [])

	assert_valid_query_output(built)
})

test('typed_query_builder: select fn accepts a value in any argument position', () => {
	const built = q.from('project AS p')
		.select(b => [
			b.fn('IFNULL', { value: 'fallback' }, 'p.notes_for_crew', 'p.notes'),
			b.fn('MAX', { value: 5n }, 'p.max_value'),
		])
		.build()

	type ExpectedRowType = {
		p: {
			notes: string | null
			max_value: 5n | null
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	const { sql, values } = safe_select_query_builder.to_sql(built.query)
	assert.strictEqual(sql, 'SELECT IFNULL(?, `p`.`notes_for_crew`) AS `notes`, MAX(?) AS `max_value`\nFROM `project` AS `p`')
	assert.deepStrictEqual(values, ['fallback', 5n])

	assert_valid_query_output(built)
})

test('typed_query_builder: select with IFNULL of a column and a value or column', () => {
	const built = q.from('project AS p')
		.select(b => [
			b.fn('IFNULL', 'p.assigned_estimator_employee_id', { value: 0n }, 'p.estimator'),
			b.fn('IFNULL', 'p.notes_for_crew', 'p.notes_for_office', 'p.crew_or_office_notes'),
		])
		.build()

	type ExpectedRowType = {
		p: {
			estimator: bigint
			crew_or_office_notes: string | null
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	const { sql, values } = safe_select_query_builder.to_sql(built.query)
	assert.strictEqual(sql, 'SELECT IFNULL(`p`.`assigned_estimator_employee_id`, ?) AS `estimator`, IFNULL(`p`.`notes_for_crew`, `p`.`notes_for_office`) AS `crew_or_office_notes`\nFROM `project` AS `p`')
	assert.deepStrictEqual(values, [0n])

	assert_valid_query_output(built)
})

test('typed_query_builder: where with UUID_TO_BIN function expression', () => {
	const built = q.from('project AS p')
		.where(q => q.comparison('p.project_id', '=', q.fn('UUID_TO_BIN', { value: 'some-uuid' })))
		.build()
	assert_valid_query_output(built)
})

test('typed_query_builder: group_by with column refs', () => {
	const built = q.from('project AS p')
		.join('project_line_item AS pli', on => on.comparison('pli.project_id', '=', 'p.project_id'))
		.group_by('p.project_id')
		.build()
	assert_valid_query_output(built)
})

test('typed_query_builder: order_by and limit', () => {
	const built = q.from('project AS p')
		.select(() => ['p.project_id'])
		.order_by('p.created_at')
		.order_by('p.project_id', 'DESC')
		.limit(10n)
		.build()

	assert.deepStrictEqual(built.query.order_by, [
		{ expression: { type: 'column reference', table_identifier: 'p', column: 'created_at' }, direction: 'ASC' },
		{ expression: { type: 'column reference', table_identifier: 'p', column: 'project_id' }, direction: 'DESC' },
	])
	assert.strictEqual(built.query.limit, 10n)

	assert_valid_query_output(built)
})

test('typed_query_builder: SelectedIdentifiers is the union of selected output names', () => {
	const built = q.from('project AS p')
		.join('project_line_item AS pli', on => on.comparison('pli.project_id', '=', 'p.project_id'))
		.select(b => [
			'p.project_id',
			'p.company_id AS co',
			b.fn('COUNT', 'pli.project_line_item_id', 'pli.line_count'),
		])
		.build()

	type Ids = SelectedIdentifiers<typeof built>
	const _ids_check: AssertEqual<Ids, 'project_id' | 'co' | 'line_count'> = true
	void _ids_check
})

test('typed_query_builder: order_by by alias, table column, and inline function; having on aliases', () => {
	const built = q.from('project AS p')
		.join('project_line_item AS pli', on => on.comparison('pli.project_id', '=', 'p.project_id'))
		.select(b => [
			'p.project_id',
			b.fn('COUNT', 'pli.project_line_item_id', 'pli.line_count'),
		])
		.group_by('p.project_id')
		.having(b => b.comparison('line_count', '>', { value: 1 }))
		.order_by('line_count', 'DESC')
		.order_by('p.project_id')
		.order_by(b => b.fn('COUNT', 'pli.project_line_item_id'))
		.build()

	assert.deepStrictEqual(built.query.order_by, [
		{ expression: { type: 'alias reference', alias: 'line_count' }, direction: 'DESC' },
		{ expression: { type: 'column reference', table_identifier: 'p', column: 'project_id' }, direction: 'ASC' },
		{ expression: { type: 'function', function: 'COUNT', arguments: [{ type: 'column reference', table_identifier: 'pli', column: 'project_line_item_id' }] }, direction: 'ASC' },
	])

	assert.deepStrictEqual(built.query.having, {
		type: 'and',
		expressions: [
			{ type: 'comparison', left: { type: 'alias reference', alias: 'line_count' }, comparator: '>', right: { type: 'user provided value', value: 1 } },
		],
	})

	assert_valid_query_output(built)
})

test('typed_query_builder: nested AND/OR in where, select grouping, group_by', () => {
	const built = q.from('project AS p')
		.where(q => q.and(
			q.or(
				q.comparison('p.closed', '=', { value: 0 }),
				q.comparison('p.emergency', '=', { value: 1 }),
			),
			q.comparison('p.company_id', '=', { value: 5 }),
		))
		.select(b => [
			'p.project_id',
			b.and('p.closed', 'p.emergency', 'p.is_valid'),
		])
		.group_by('p.project_id', 'p.company_id')
		.build()
	assert_valid_query_output(built)
})

test('typed_query_builder: type errors on invalid references', () => {
	// @ts-expect-error: projectz is not a valid table name
	q.from('projectz')

	// @ts-expect-error: projectz is not a valid table name
	q.from('projectz AS p')

	q.from('project AS p')
		// @ts-expect-error: project was aliased to p
		.join('project_line_item AS pli', on => on.comparison('pli.project_id', '=', 'project.project_id'))

	q.from('project AS p')
		// @ts-expect-error: project_line_item was aliased to pli
		.join('project_line_item AS pli', on => on.comparison('project_line_item.project_id', '=', 'p.project_id'))

	// @ts-expect-error: pli is valid in this context, project_line_item is not
	q.from('project_line_item AS pli').where(q => q.comparison('project_line_item.project_id', '=', { value: 2 }))

	q.from('project AS p')
		.where(q => q.and(
			// @ts-expect-error: pli is not a valid reference here
			q.comparison('pli.item_type_id', '=', { value: 3 }),
			q.comparison('p.company_id', '=', { value: 4 })
		))

	// @ts-expect-error: project was aliased to p, so 'project' is not a valid table identifier in select
	q.from('project AS p').select(() => ['project.project_id'])

	// @ts-expect-error: 'not_a_column' is not a column on project
	q.from('project AS p').select(() => ['p.not_a_column'])

	// @ts-expect-error: project was aliased to p, so 'project' is not a valid table identifier in group_by
	q.from('project AS p').group_by('project.project_id')

	// @ts-expect-error: 'not_a_column' is not a column on project
	q.from('project AS p').group_by('p.not_a_column')

	// @ts-expect-error: project was aliased to p, so 'project' is not a valid table identifier in order_by
	q.from('project AS p').order_by('project.project_id')

	// @ts-expect-error: 'not_a_column' is not a column on project
	q.from('project AS p').order_by('p.not_a_column')

	// @ts-expect-error: 'co' has not been selected, so it is not a valid order_by alias
	q.from('project AS p').select(() => ['p.project_id']).order_by('co')

	// @ts-expect-error: having operands must be selected aliases, not unselected names
	q.from('project AS p').select(() => ['p.project_id']).having(b => b.comparison('not_selected', '>', { value: 1 }))

	// @ts-expect-error: having operands must be selected aliases, not table-qualified columns
	q.from('project AS p').select(() => ['p.project_id AS pid']).having(b => b.comparison('p.project_id', '>', { value: 1 }))

	// @ts-expect-error: limit expects a bigint, not a number
	q.from('project AS p').limit(5)

	q.from('project AS p')
		.where(q => q.or(
			// @ts-expect-error: pli is not a valid reference here
			q.comparison('pli.item_type_id', '=', { value: 3 }),
			q.comparison('p.company_id', '=', { value: 4 })
		))

	q.from('project AS p')
		.select(b => [
			b.and(
				// @ts-expect-error: 'not_a_column' is not a column on project
				'p.not_a_column',
				'p.emergency',
				'p.result',
			),
		])

	q.from('project AS p')
		.select(b => [
			b.or(
				// @ts-expect-error: 'not_a_column' is not a column on project
				'p.emergency',
				'p.not_a_column',
				'p.result',
			),
		])
})

test('typed_query_builder: left_join marks the join left and nulls its selected columns', () => {
	const built = q.from('project AS p')
		.left_join('project_document AS pd', on => on.comparison('p.project_document_id', '=', 'pd.project_document_id'))
		.select(() => [
			'p.project_id',
			'pd.name',
			'pd.group_name AS grp',
		])
		.build()

	type ExpectedRowType = {
		p: {
			project_id: bigint
		}
		pd: {
			name: string
			grp: string
		} | {
			name: null
			grp: null
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	assert.strictEqual(built.query.joins[0]!.left, true)

	assert_valid_query_output(built)
})

test('typed_query_builder: inner join columns stay non-null alongside a left_join', () => {
	const built = q.from('project AS p')
		.left_join('project_document AS pd', on => on.comparison('p.project_document_id', '=', 'pd.project_document_id'))
		.join('project_line_item AS pli', on => on.comparison('pli.project_id', '=', 'p.project_id'))
		.select(() => [
			'pd.name',
			'pli.price',
		])
		.build()

	type ExpectedRowType = {
		pd: {
			name: string
		} | {
			name: null
		}
		pli: {
			price: FinancialNumber
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	assert.strictEqual(built.query.joins[0]!.left, true)
	assert.strictEqual(built.query.joins[1]!.left, false)

	assert_valid_query_output(built)
})

const first_documents = q.from('project_document AS pd')
	.select(() => ['pd.project_document_id', 'pd.name AS document_name'])
	.order_by('pd.project_document_id')
	.limit(2n)
	.build()

test('typed_query_builder: a built query as a derived table keeps its column types', () => {
	const built = q.from({ subquery: first_documents, alias: 'top' })
		.join('project AS p', on => on.comparison('p.project_document_id', '=', 'top.project_document_id'))
		.select(() => ['p.project_id', 'top.document_name'])
		.build()

	type ExpectedRowType = {
		p: {
			project_id: bigint
		}
		top: {
			document_name: string
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	assert.deepStrictEqual(built.query.from, { subquery: first_documents.query, alias: 'top' })
	assert_valid_query_output(built)

	// @ts-expect-error: the subquery aliased name to document_name, so name is not a column of top
	q.from({ subquery: first_documents, alias: 'top' }).select(() => ['top.name'])

	// @ts-expect-error: project_document was aliased to top
	q.from({ subquery: first_documents, alias: 'top' }).select(() => ['project_document.name'])
})

test('typed_query_builder: a derived table subquery must be a built query', () => {
	// @ts-expect-error: a plain safe select query carries no column types
	q.from({ subquery: first_documents.query, alias: 'top' })
})

test('typed_query_builder: derived table alias must be an identifier', () => {
	assert.throws(() => q.from({ subquery: first_documents, alias: 'top` UNION SELECT' }))
})

test('typed_query_builder: a built query as a joined derived table keeps its column types', () => {
	const built = q.from('project AS p')
		.join({ subquery: first_documents, alias: 'top' }, on => on.comparison('top.project_document_id', '=', 'p.project_document_id'))
		.select(() => ['p.project_id', 'top.document_name'])
		.build()

	type ExpectedRowType = {
		p: {
			project_id: bigint
		}
		top: {
			document_name: string
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	assert.deepStrictEqual(built.query.joins, [{ subquery: first_documents.query, alias: 'top', on_clause: built.query.joins[0]!.on_clause, left: false }])
	assert_valid_query_output(built)

	q.from('project AS p')
		// @ts-expect-error: the subquery aliased name to document_name, so name is not a column of top
		.join({ subquery: first_documents, alias: 'top' }, on => on.comparison('top.name', '=', 'p.project_document_id'))
})

test('typed_query_builder: a left-joined derived table nulls its selected columns', () => {
	const built = q.from('project AS p')
		.left_join({ subquery: first_documents, alias: 'top' }, on => on.comparison('top.project_document_id', '=', 'p.project_document_id'))
		.join('project_line_item AS pli', on => on.comparison('pli.project_id', '=', 'p.project_id'))
		.select(() => ['top.document_name', 'pli.price'])
		.build()

	type ExpectedRowType = {
		top: {
			document_name: string
		} | {
			document_name: null
		}
		pli: {
			price: FinancialNumber
		}
	}

	const _row_type_check: AssertEqual<ExtractQueryResponse<typeof built>, ExpectedRowType> = true
	void _row_type_check

	assert.strictEqual(built.query.joins[0]!.left, true)
	assert_valid_query_output(built)
})
