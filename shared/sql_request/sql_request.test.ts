import { test } from 'node:test'
import * as assert from 'node:assert'
import { make_query_validator, type TrustableSelectQuery } from './index.ts'
import { type FinancialNumber } from 'financial-number'
import { Temporal } from '@js-temporal/polyfill'

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



test('valid query', () => {
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
			}, {
				type: 'function',
				function: 'IS NOT NULL',
				arguments: [{
					type: 'column reference',
					table_identifier: 'project',
					column: 'client_id',
				}],
			}]
		}],
		where: [{
			type: 'comparison',
			left: {
				type: 'column reference',
				table_identifier: 'project',
				column: 'client_id',
			},
			comparator: '=',
			right: {
				type: 'user provided value',
				value: 1,
			},
		}]
	} satisfies TrustableSelectQuery

	const { validate, to_sql } = make_query_validator(test_schema)

	assert.strictEqual(validate(valid_query).valid, true)

	const { sql, parameters } = to_sql(valid_query)
	assert.strictEqual(sql, 'SELECT `project`.`project_id`, COUNT(`project`.`project_id`) AS `count_project_id`\nFROM `project` AS `p`\nJOIN `client` AS `c` ON `project`.`client_id` = `client`.`client_id`\n\tAND `project`.`client_id` IS NOT NULL\nWHERE `project`.`client_id` = ?')
	assert.deepStrictEqual(parameters, [1])
})

test('invalid table', () => {
	const query = {
		select: [{
			type: 'column reference',
			table_identifier: 'nonexistent_table',
			column: 'id',
		}],
		from: {
			table_name: 'nonexistent_table',
			alias: 'n',
		},
		joins: [],
		where: [],
	} satisfies TrustableSelectQuery

	const { validate } = make_query_validator(test_schema)
	const result = validate(query)

	assert.strictEqual(result.valid, false)
	console.log(result.messages)
	assert.strictEqual(result.messages.length, 1)
})

test('invalid column', () => {
	const query = {
		select: [{
			type: 'column reference',
			table_identifier: 'project',
			column: 'nonexistent_column',
		}],
		from: {
			table_name: 'project',
			alias: 'p',
		},
		joins: [],
		where: [],
	} satisfies TrustableSelectQuery

	const { validate } = make_query_validator(test_schema)
	const result = validate(query)

	assert.strictEqual(result.valid, false)
	console.log(result.messages)
	assert.strictEqual(result.messages.length, 1)
})
