import * as jv from '#shared/json_validator.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import { is_temporal_plain_date } from '#schema/validator/_helpers.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import safe_query_builder from '#worker/lib/db/safe_query_builder.ts'
import type { Schema } from '#schema/types.ts'

const create_lead_validator = jv.object({
	client_id: jv.is_bigint,
	// Omit to put the project at the client's primary address; pass one of the client's
	// other address ids to use a different job site.
	client_address_id: jv.optional(jv.is_bigint),
	lead_details: jv.optional(jv.nullable(jv.is_string)),
	emergency: jv.optional(jv.is_boolean),
	due_date: jv.optional(jv.nullable(is_temporal_plain_date)),
})

export const functions = {
	create_lead: sfn({
		validator: create_lead_validator,
		fn: async (arg, context): Promise<Pick<DbProject, 'project_id'>> => {
			const { mysql, company, user } = context
			const company_id = company.company_id

			// Resolve which address the project sits at, defaulting to the client's primary.
			const client_query = query_builder<Schema>()
				.from('client')
				.where(q => q.and(
					q.comparison('client.company_id', '=', { value: company_id }),
					q.comparison('client.client_id', '=', { value: arg.client_id }),
				))
				.select(() => [ 'client.primary_client_address_id' ])
				.build()

			const client_row = await mysql.query(safe_query_builder.to_sql(client_query.query)).get_first_row<unknown[]>()
			if (!client_row) {
				throw new Error(`No client found with client_id ${ arg.client_id }`)
			}
			const { client } = client_query.positional_row_to_named(client_row)

			const client_address_id = arg.client_address_id ?? client.primary_client_address_id

			// The project keeps its own snapshot of the address lines, so read them off the
			// chosen client_address row.
			const address_query = query_builder<Schema>()
				.from('client_address')
				.where(q => q.and(
					q.comparison('client_address.company_id', '=', { value: company_id }),
					q.comparison('client_address.client_id', '=', { value: arg.client_id }),
					q.comparison('client_address.client_address_id', '=', { value: client_address_id }),
				))
				.select(() => [
					'client_address.address_line_1',
					'client_address.address_line_2',
					'client_address.city',
					'client_address.state',
					'client_address.zip',
				])
				.build()

			const address_row = await mysql.query(safe_query_builder.to_sql(address_query.query)).get_first_row<unknown[]>()
			if (!address_row) {
				throw new Error(`No client_address found with client_address_id ${ client_address_id } for client_id ${ arg.client_id }`)
			}
			const { client_address: address } = address_query.positional_row_to_named(address_row)

			const project_id = await mysql.query({
				sql: 'INSERT INTO project SET ?',
				values: {
					company_id,
					project_document_id: company.default_initial_project_document_id,
					client_id: arg.client_id,
					client_address_id,
					address_line_1: address.address_line_1,
					address_line_2: address.address_line_2,
					city: address.city,
					state: address.state,
					zip: address.zip,
					due_date: arg.due_date ? arg.due_date.toString() : null,
					emergency: arg.emergency ?? false,
					lead_details: arg.lead_details ?? null,
					created_by_employee_id: user.employee_id,
					needs_client_approval: false,
					sent_for_client_approval: false,
				},
			}).get_insert_id()

			return { project_id }
		},
	}),
}
