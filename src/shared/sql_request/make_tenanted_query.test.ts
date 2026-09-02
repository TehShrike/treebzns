import { test } from 'node:test'
import * as assert from 'node:assert'
import { type Temporal } from '@js-temporal/polyfill'
import { type FinancialNumber } from 'financial-number'
import prep_tenant_function from './make_tenanted_query.ts'
import { every, some } from '#shared/array.ts'
import { comparison_validator, column_reference_validator, type Comparison, type SafeSelectQuery } from './safe_select_query_validator.ts'

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
	permission: {
		permission_id: 'permission_id',
		code: 'code',
		name: 'name',
		created_at: 'created_at',
		updated_at: 'updated_at',
	}
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
	permission: {
		permission_id: bigint
		code: string
		name: string
		created_at: Temporal.Instant
		updated_at: Temporal.Instant
	}
}

test(`column_name must be a column present in every tenanted table`, () => {
	prep_tenant_function<TestSchema, `permission`>({ non_tenanted_table_names: [`permission`], column_name: `company_id` })

	prep_tenant_function<TestSchema, `permission` | `project_line_item`>({ non_tenanted_table_names: [`permission`, `project_line_item`], column_name: `client_id` })

	// @ts-expect-error project_id is missing from the `client` tenanted table
	prep_tenant_function<TestSchema, `permission`>({ non_tenanted_table_names: [`permission`], column_name: `project_id` })
})

const is_company_column_reference = (column_reference: unknown, table_alias: string): boolean =>{
	return column_reference_validator.is_valid(column_reference)
		&& column_reference.table_identifier === table_alias
		&& column_reference.column === `company_id`
}
const is_company_id_filter = (node: unknown, table_alias: string, value: any): boolean =>{
	if (comparison_validator.is_valid(node)) {
		const company_column_reference = node.left.type === 'column reference' ? node.left : node.right
		const value_reference = node.left.type === 'column reference' ? node.right : node.left

		return is_company_column_reference(company_column_reference, table_alias)
			&& value_reference.type === 'user provided value' && value_reference.value === value
			&& node.comparator === '='
	}

	return false
}

function assert_has_two_elements<T>(array: T[]): asserts array is [T, T] {
	if (array.length !== 2) {
		throw new Error('Array must have exactly two elements')
	}
}

test(`company_id is injected into the where and joins of tenanted tables`, () => {
	const add_tenancy = prep_tenant_function<TestSchema, `permission`>({
		non_tenanted_table_names: [`permission`],
		column_name: `company_id`,
	})

	const query: SafeSelectQuery = {
		select: [ { type: `column reference`, table_identifier: `project`, column: `project_id` } ],
		from: { table_name: `project`, alias: `project_alias` },
		joins: [
			{
				table_name: `project_line_item`,
				alias: `project_line_item_alias`,
				on_clause: [ {
					type: `comparison`,
					left: { type: `column reference`, table_identifier: `project_line_item`, column: `project_id` },
					comparator: `=`,
					right: { type: `column reference`, table_identifier: `project`, column: `project_id` },
				} ],
			},
			{
				table_name: `permission`,
				alias: `permission_alias`,
				on_clause: [ {
					type: `comparison`,
					left: { type: `column reference`, table_identifier: `permission`, column: `permission_id` },
					comparator: `=`,
					right: { type: `user provided value`, value: 1n },
				} ],
			},
		],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	}

	const tenanted_query = add_tenancy(query, 42n)

	assert.ok(tenanted_query.where)
	assert.ok(tenanted_query.where.type === 'and')
	assert.ok(is_company_id_filter(tenanted_query.where.expressions[0], `project_alias`, 42n))

	assert_has_two_elements(tenanted_query.joins)
	assert_has_two_elements(tenanted_query.joins[0].on_clause)
	assert.strictEqual(tenanted_query.joins[1].on_clause.length, 1)

	assert.ok(some(tenanted_query.joins[0].on_clause, node => is_company_id_filter(node, `project_line_item_alias`, 42n)))
	assert.ok(every(tenanted_query.joins[1].on_clause, node => !is_company_id_filter(node, `permission_alias`, 42n)))
})

test(`company_id is injected inside a derived table subquery, not on the derived table itself`, () => {
	const add_tenancy = prep_tenant_function<TestSchema, `permission`>({
		non_tenanted_table_names: [`permission`],
		column_name: `company_id`,
	})

	const query: SafeSelectQuery = {
		select: [ { type: `column reference`, table_identifier: `top`, column: `project_id` } ],
		from: {
			subquery: {
				select: [ { type: `column reference`, table_identifier: `project_alias`, column: `project_id` } ],
				from: { table_name: `project`, alias: `project_alias` },
				joins: [],
				where: null,
				group_by: [],
				order_by: [],
				limit: 2n,
				having: null,
			},
			alias: `top`,
		},
		joins: [
			{
				table_name: `project_line_item`,
				alias: `project_line_item_alias`,
				on_clause: [ {
					type: `comparison`,
					left: { type: `column reference`, table_identifier: `project_line_item_alias`, column: `project_id` },
					comparator: `=`,
					right: { type: `column reference`, table_identifier: `top`, column: `project_id` },
				} ],
			},
		],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	}

	const tenanted_query = add_tenancy(query, 42n)

	assert.strictEqual(tenanted_query.where, null)

	assert.ok(`subquery` in tenanted_query.from)
	const subquery_where = tenanted_query.from.subquery.where
	assert.ok(subquery_where)
	assert.ok(is_company_id_filter(subquery_where.expressions[0], `project_alias`, 42n))

	assert.strictEqual(tenanted_query.joins.length, 1)
	assert.ok(some(tenanted_query.joins[0]!.on_clause, node => is_company_id_filter(node, `project_line_item_alias`, 42n)))
})
