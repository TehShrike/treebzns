import * as jv from "#shared/json_validator.ts"
import { sfns } from "#worker/lib/server_functions_api.ts"

export const functions = sfns({
	ping: {
		validator: jv.object({
			timeout: jv.one_of(jv.exact(1000n as const), jv.exact(2000n as const), jv.exact(3000n as const)),
		}),
		fn: async (arg, context) => {
			await new Promise(resolve => setTimeout(resolve, Number(arg.timeout)))
			return {
				pong: true,
				user_id: context.user.employee_id,
			}
		},
	},
})
