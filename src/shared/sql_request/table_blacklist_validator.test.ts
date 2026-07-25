import { test } from 'node:test'
import * as assert from 'node:assert'
import make_blackist_validator from './table_blacklist_validator.ts'
import type { SafeSqlQuery } from './safe_sql_query_validator.ts'
import type { Temporal } from '@js-temporal/polyfill'
import type { FinancialNumber } from 'financial-number'

type TestSchema = {
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
	employee_session: {
		employee_session_id: bigint
		employee_id: bigint
		session_id: string
		created_at: Temporal.Instant
		updated_at: Temporal.Instant
	}
}

const make_query = (from_table: string, join_table: string): SafeSqlQuery => ({
	select: [],
	from: { table_name: from_table, alias: from_table },
	joins: [ { table_name: join_table, alias: join_table, on_clause: [] } ],
	where: null,
	group_by: [],
	order_by: [],
	limit: null,
	having: null,
})

function assert_has_one_element<T>(array: T[]): asserts array is [T] {
	if (array.length !== 1) {
		throw new Error('Array must have exactly one element')
	}
}

test(`table_blacklist_validator`, () => {
	const validate = make_blackist_validator<TestSchema>([ `employee_session` ])

	assert.deepEqual(validate(make_query(`project`, `project_line_item`)), [], `no messages when no blacklisted table is referenced`)

	const bad_join_table_output = validate(make_query(`project`, `employee_session`))
	assert_has_one_element(bad_join_table_output)
	assert.strictEqual(bad_join_table_output[0].includes('employee_session'), true)

	const bad_from_table_output = validate(make_query(`employee_session`, `project_line_item`))
	assert_has_one_element(bad_from_table_output)
	assert.strictEqual(bad_from_table_output[0].includes('employee_session'), true)
})
