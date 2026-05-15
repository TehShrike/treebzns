import { json_response } from './response_helpers.ts'
import type { Env } from './environment.ts'
import { create_pool } from '#worker/lib/mysql/connection.ts'
import type { Pool } from 'mysql2/promise'

let pool: Pool | null = null

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		pool ??= create_pool(env)
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
