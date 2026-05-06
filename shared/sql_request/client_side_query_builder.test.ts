import { test } from 'node:test'
import type { FinancialNumber } from 'financial-number'
import query_builder from './client_side_query_builder.ts'
import { make_safe_query_builder, type TrustableSelectQuery } from './sql_request.ts'
import * as assert from 'node:assert'
import {trustable_select_query_validator} from './trustable_select_query.ts'

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

const safe_query_builder = make_safe_query_builder(example_schema)
function assert_valid_query_output(select_query: TrustableSelectQuery) {
	const query_is_safe = trustable_select_query_validator.is_valid(select_query)

	if (!query_is_safe) {
		console.log(trustable_select_query_validator.get_messages(select_query, 'select_query'))
	}

	assert.strictEqual(query_is_safe, true)

	const validity = safe_query_builder.validate_table_and_column_names(select_query)
	if (!validity.valid) {
		console.log(validity.messages)
	}
	assert.strictEqual(validity.valid, true)
}


const q = query_builder<ExampleSchema>()

test('client_side_query_builder: from with valid table', () => {
	const built = q.from('project', 'projectz').build()
	assert_valid_query_output(built)
})

test('client_side_query_builder: chained joins with column refs by alias', () => {
	const built = q.from('project', 'p')
		.join('project_line_item', 'pli', on => on.comparison({ table: 'pli', column: 'project_id' }, '=', { table: 'p', column: 'project_id' }))
		.join('project_document', 'pd', on => on.comparison({ table: 'p', column: 'project_document_id' }, '=', { table: 'pd', column: 'project_document_id' }))
		.build()
	assert_valid_query_output(built)
})

test('client_side_query_builder: where with column ref against value', () => {
	const built = q.from('project_line_item', 'pli')
		.where(q => q.comparison({ table: 'pli', column: 'project_id' }, '=', { value: 2 }))
		.build()
	assert_valid_query_output(built)
})

test('client_side_query_builder: where after join with and', () => {
	const built = q.from('project', 'p')
		.join('project_line_item', 'pli', on => on.comparison({ table: 'pli', column: 'project_id' }, '=', { table: 'p', column: 'project_id' }))
		.where(q => q.and(
			q.comparison({ table: 'pli', column: 'item_type_id' }, '=', { value: 3 }),
			q.comparison({ table: 'p', column: 'company_id' }, '=', { value: 4 }),
		))
		.build()
	assert_valid_query_output(built)
})

test.skip('client_side_query_builder: type errors on invalid references', () => {
	// @ts-expect-error: projectz is not a valid table name
	q.from('projectz', 'project')

	q.from('project', 'p')
		// @ts-expect-error: project was aliased to p
		.join('project_line_item', 'pli', on => on.comparison({ table: 'pli', column: 'project_id' }, '=', { table: 'project', column: 'project_id' }))

	q.from('project', 'p')
		// @ts-expect-error: project_line_item was aliased to pli
		.join('project_line_item', 'pli', on => on.comparison({ table: 'project_line_item', column: 'project_id' }, '=', { table: 'p', column: 'project_id' }))

	// @ts-expect-error: pli is valid in this context, project_line_item is not
	q.from('project_line_item', 'pli').where(q => q.comparison({ table: 'project_line_item', column: 'project_id' }, '=', { value: 2 }))

	q.from('project', 'p')
		.where(q => q.and(
			// @ts-expect-error: pli is not a valid reference here
			q.comparison({ table: 'pli', column: 'item_type_id' }, '=', { value: 3 }),
			q.comparison({ table: 'p', column: 'company_id' }, '=', { value: 4 }),
		))
})
