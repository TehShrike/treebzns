import * as jv from "#shared/json_validator.ts"
import { sfns } from "#shared/server_functions_api.ts"

export const functions = sfns({
	ping: {
		validator: jv.object({
			timeout: jv.one_of(jv.exact(1000 as const), jv.exact(2000 as const), jv.exact(3000 as const)),
		}),
		fn: async (arg, context): Promise<{ pong: boolean }> => {
			await new Promise(resolve => setTimeout(resolve, arg.timeout))
			return { pong: true }
		},
	},
})
