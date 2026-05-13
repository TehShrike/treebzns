import { json_response } from './response_helpers.ts'
import type { Env } from './environment.ts'

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const path = new URL(request.url).pathname
		if (path.startsWith('/api/')) {
			return json_response({
				body: { placeholder: true },
				status: 200
			})
		}
		return env.ASSETS.fetch(request)
	},
} satisfies ExportedHandler<Env>
