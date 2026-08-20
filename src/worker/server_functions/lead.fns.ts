import * as jv from '#shared/json_validator.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import { is_temporal_plain_date } from '#schema/validator/_helpers.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import safe_query_builder from '#shared/treebzns_db/safe_query_builder.ts'
import write_helper from '#worker/lib/mysql/write_helper.ts'
import { transaction } from '#worker/lib/mysql/helpers.ts'
import type { Schema } from '#schema/types.ts'

const create_lead_validator = jv.object({
	client_id: jv.is_bigint,
	client_address_id: jv.is_bigint,
	lead_details: jv.is_string,
	emergency: jv.is_boolean,
	due_date: jv.optional(jv.nullable(is_temporal_plain_date)),
})

export const functions = {
	create_lead: sfn({
		validator: create_lead_validator,
		fn: (arg, context): Promise<Pick<DbProject, 'project_id'>> => transaction(context.mysql.connection, async () => {
			const { mysql, company, user } = context
			const company_id = company.company_id

			const address_query = query_builder<Schema>()
				.from('client_address')
				.join('client', b => b.comparison('client_address.client_id', '=', 'client.client_id'))
				.left_join('client_contact', b => b.comparison('client_address.client_contact_id', '=', 'client_contact.client_contact_id'))
				.where(q => q.and(
					q.comparison('client_address.company_id', '=', { value: company_id }),
					q.comparison('client_address.client_id', '=', { value: arg.client_id }),
					q.comparison('client_address.client_address_id', '=', { value: arg.client_address_id }),
				))
				.select(() => [
					'client_address.address_line_1',
					'client_address.address_line_2',
					'client_address.city',
					'client_address.state',
					'client_address.zip',
					'client_contact.name',
					'client_contact.phone',
					'client_contact.email',
					'client.name',
					'client.primary_phone',
					'client.primary_email',
				])
				.build()

			const address_row = await mysql.query(safe_query_builder.to_sql(address_query.query)).get_first_row()
			if (!address_row) {
				throw new Error(`No client_address found with client_address_id "${ arg.client_address_id }" for client_id "${ arg.client_id }"`)
			}
			const { client_address, client, client_contact } = address_query.positional_row_to_named(address_row)

			// The initial document is the lowest-sort project_document — the same rule
			// create_company used when this lived on company.default_initial_project_document_id.
			const initial_document_query = query_builder<Schema>()
				.from('project_document')
				.order_by('project_document.sort', 'ASC')
				.limit(1n)
				.select(() => ['project_document.project_document_id'])
				.build()
			const initial_document_row = await mysql.query(safe_query_builder.to_sql(initial_document_query.query)).get_first_row()
			if (!initial_document_row) {
				throw new Error('No project_document rows exist to use as the initial project document')
			}
			const initial_project_document_id = initial_document_query.positional_row_to_named(initial_document_row).project_document.project_document_id

			// LAST_INSERT_ID(expr) makes the taken number readable from this UPDATE's insertId,
			// so no second query or explicit lock is needed — the UPDATE's own row lock is what
			// makes each number claimable by only one transaction.
			const number = await mysql.query({
				sql: 'UPDATE project_number SET next_number = LAST_INSERT_ID(next_number) + 1 WHERE company_id = ?',
				values: [company_id],
			}).get_insert_id()
			if (number === 0n) {
				throw new Error(`No project_number row exists for company "${ company_id }"`)
			}

			const { insert_id: project_id } = await write_helper.insert(mysql.connection, 'project', {
				company_id,
				number,
				project_document_id: initial_project_document_id,
				client_id: arg.client_id,
				client_address_id: arg.client_address_id,
				address_line_1: client_address.address_line_1,
				address_line_2: client_address.address_line_2,
				city: client_address.city,
				state: client_address.state,
				zip: client_address.zip,
				contact_name: client_contact.name || client.name,
				contact_phone: client_contact.phone || client.primary_phone,
				contact_email: client_contact.email || client.primary_email,
				due_date: arg.due_date ?? null,
				emergency: arg.emergency,
				lead_details: arg.lead_details,
				lead_source: '',
				discount_description: '',
				notes_for_crew: '',
				notes_for_office: '',
				created_by_employee_id: user.employee_id,
				needs_client_approval: false,
				sent_for_client_approval: false,
				taxable: false,
				closed: false,
			})

			return { project_id }
		}),
	}),
}
