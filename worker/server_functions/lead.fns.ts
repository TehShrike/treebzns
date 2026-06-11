import * as jv from '#shared/json_validator.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import { is_temporal_plain_date } from '#schema/validator/_helpers.ts'

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
			const client_row = await mysql.query({
				sql: 'SELECT primary_client_address_id FROM client WHERE company_id = ? AND client_id = ?',
				values: [ company_id, arg.client_id ],
			}).get_first_row<[ bigint ]>()

			if (!client_row) {
				throw new Error(`No client found with client_id ${ arg.client_id }`)
			}

			const client_address_id = arg.client_address_id ?? client_row[0]

			// The project keeps its own snapshot of the address lines, so read them off the
			// chosen client_address row.  Columns come back as an array because of rowsAsArray.
			const address_row = await mysql.query({
				sql: `SELECT address_line_1, address_line_2, city, state, zip
					FROM client_address
					WHERE company_id = ? AND client_id = ? AND client_address_id = ?`,
				values: [ company_id, arg.client_id, client_address_id ],
			}).get_first_row<[ string, string | null, string, string, string ]>()

			if (!address_row) {
				throw new Error(`No client_address found with client_address_id ${ client_address_id } for client_id ${ arg.client_id }`)
			}

			const [ address_line_1, address_line_2, city, state, zip ] = address_row

			const project_id = await mysql.query({
				sql: 'INSERT INTO project SET ?',
				values: {
					company_id,
					project_document_id: company.default_initial_project_document_id,
					client_id: arg.client_id,
					client_address_id,
					address_line_1,
					address_line_2,
					city,
					state,
					zip,
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
