import * as jv from "#shared/json_validator.ts"
import { sfns, sfn } from "#worker/lib/server_functions_api.ts"
import { pick } from "#shared/pick.ts"
import { validator_object } from '#schema/validator/company.ts'

const slim_validator_object = pick(validator_object, ['name'])

export const functions = {
	create_company: sfn({
		validator: jv.object(slim_validator_object),
		fn: async (arg, context): Promise<Pick<DbCompany, 'company_id' | 'name'>> => {
			return { company_id: 666n, ...arg }
		},
	}),
}
