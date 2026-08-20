import * as jv from '#shared/json_validator.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import { transaction } from '#worker/lib/mysql/helpers.ts'
import write_helper from '#worker/lib/mysql/write_helper.ts'

const address_validator = jv.object({
	name: jv.is_string,
	address_line_1: jv.is_string,
	address_line_2: jv.is_string,
	city: jv.is_string,
	state: jv.is_string,
	zip: jv.is_string,
})

const create_client_validator = jv.object({
	name: jv.is_string,
	is_commercial: jv.is_boolean,
	primary_phone: jv.is_string,
	primary_email: jv.is_string,
	tax_rate_id: jv.optional(jv.nullable(jv.is_bigint)),
	notes: jv.is_string,
	referred_by: jv.is_string,
	primary_address: address_validator,
})

export const functions = {
	create_client: sfn({
		validator: create_client_validator,
		fn: async (arg, context): Promise<Pick<DbClient, 'client_id' | 'default_project_address_id'>> => {
			const { mysql, company } = context
			const company_id = company.company_id

			return transaction(mysql.connection, async () => {
				const { insert_id: client_id } = await write_helper.insert(mysql.connection, 'client', {
					company_id,
					name: arg.name,
					is_commercial: arg.is_commercial,
					default_project_address_id: 0n,
					billing_name: '',
					billing_address_line_1: '',
					billing_address_line_2: '',
					billing_city: '',
					billing_state: '',
					billing_zip: '',
					primary_phone: arg.primary_phone,
					primary_email: arg.primary_email,
					tax_rate_id: arg.tax_rate_id ?? null,
					notes: arg.notes,
					referred_by: arg.referred_by,
				})

				const { primary_address } = arg
				const { insert_id: client_address_id } = await write_helper.insert(mysql.connection, 'client_address', {
					company_id,
					client_id,
					client_contact_id: null,
					name: primary_address.name,
					address_line_1: primary_address.address_line_1,
					address_line_2: primary_address.address_line_2,
					city: primary_address.city,
					state: primary_address.state,
					zip: primary_address.zip,
				})

				await mysql.query({
					sql: 'UPDATE client SET default_project_address_id = ? WHERE company_id = ? AND client_id = ?',
					values: [ client_address_id, company_id, client_id ],
				})

				return {
					client_id,
					default_project_address_id: client_address_id,
				}
			})
		},
	}),
}
