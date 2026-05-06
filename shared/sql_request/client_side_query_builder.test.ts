import { test } from 'node:test'
import type { FinancialNumber } from 'financial-number'
import type { QueryBuilder } from './client_side_query_builder.ts'

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


const query_builder = (() => {}) as QueryBuilder<ExampleSchema>
const q = query_builder()

test.skip('client_side_query_builder: from with valid table', () => {
	q.from('project', 'projectz')
})

test.skip('client_side_query_builder: chained joins with column refs by alias', () => {
	q.from('project', 'p')
		.join('project_line_item', 'pli', on => on.comparison({ table: 'pli', column: 'project_id' }, '=', { table: 'p', column: 'project_id' }))
		.join('project_document', 'pd', on => on.comparison({ table: 'p', column: 'project_document_id' }, '=', { table: 'pd', column: 'project_document_id' }))
})

test.skip('client_side_query_builder: where with column ref against value', () => {
	q.from('project_line_item', 'pli').where(q => q.comparison({ table: 'pli', column: 'project_id' }, '=', { value: 2 }))
})

test.skip('client_side_query_builder: where after join with and', () => {
	q.from('project', 'p')
		.join('project_line_item', 'pli', on => on.comparison({ table: 'pli', column: 'project_id' }, '=', { table: 'p', column: 'project_id' }))
		.where(q => q.and(
			q.comparison({ table: 'pli', column: 'item_type_id' }, '=', { value: 3 }),
			q.comparison({ table: 'p', column: 'company_id' }, '=', { value: 4 }),
		))
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
