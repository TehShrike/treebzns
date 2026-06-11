import * as jv from '#shared/json_validator.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import { transaction } from '#worker/lib/mysql/helpers.ts'

const optional_string = jv.optional(jv.nullable(jv.is_string))

const address_validator = jv.object({
	name: jv.is_string,
	address_line_1: jv.is_string,
	address_line_2: optional_string,
	city: jv.is_string,
	state: jv.is_string,
	zip: jv.is_string,
	contact: optional_string,
	phone: optional_string,
	email: optional_string,
})

const create_client_validator = jv.object({
	name: jv.is_string,
	primary_phone: optional_string,
	primary_email: optional_string,
	tax_rate_id: jv.optional(jv.nullable(jv.is_bigint)),
	notes: optional_string,
	referred_by: optional_string,
	address: address_validator,
})

export const functions = {
	create_client: sfn({
		validator: create_client_validator,
		fn: async (arg, context): Promise<Pick<DbClient, 'client_id' | 'primary_client_address_id' | 'billing_client_address_id'>> => {
			const { mysql, company } = context
			const company_id = company.company_id

			return transaction(mysql.connection, async () => {
				// client and client_address reference each other, and the address row needs a
				// client_id, so insert the client first with placeholder address ids and then
				// backfill them once the address exists.
				const client_id = await mysql.query({
					sql: 'INSERT INTO client SET ?',
					values: {
						company_id,
						name: arg.name,
						primary_client_address_id: 0,
						billing_client_address_id: 0,
						primary_phone: arg.primary_phone ?? null,
						primary_email: arg.primary_email ?? null,
						tax_rate_id: arg.tax_rate_id ?? null,
						notes: arg.notes ?? null,
						referred_by: arg.referred_by ?? null,
					},
				}).get_insert_id()

				const { address } = arg
				const client_address_id = await mysql.query({
					sql: 'INSERT INTO client_address SET ?',
					values: {
						company_id,
						client_id,
						name: address.name,
						address_line_1: address.address_line_1,
						address_line_2: address.address_line_2 ?? null,
						city: address.city,
						state: address.state,
						zip: address.zip,
						contact: address.contact ?? null,
						phone: address.phone ?? null,
						email: address.email ?? null,
					},
				}).get_insert_id()

				await mysql.query({
					sql: 'UPDATE client SET primary_client_address_id = ?, billing_client_address_id = ? WHERE company_id = ? AND client_id = ?',
					values: [ client_address_id, client_address_id, company_id, client_id ],
				})

				return {
					client_id,
					primary_client_address_id: client_address_id,
					billing_client_address_id: client_address_id,
				}
			})
		},
	}),
}
