import { json_response, error_response } from '#worker/lib/response_helpers.ts'
import { create_pool } from '#worker/lib/mysql/connection.ts'
import make_mysql_helpers_object, { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import type { Pool } from 'mysql2/promise'

import create_company from './bare_endpoints/create_company.ts'
import log_in from './bare_endpoints/log_in.ts'
import validate_session from '#worker/lib/db/validate_session.ts'

let pool: Pool | null = null

const run_with_connection = async <RESULT>(pool: Pool, fn: (connection: MysqlHelpersObject) => Promise<RESULT>): Promise<RESULT> => {
	const conn = await pool.getConnection()
	try {
		const mysql = make_mysql_helpers_object(conn)
		return await fn(mysql)
	} finally {
		conn.release()
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		pool ??= create_pool(env)
		const { pathname, method } = Object.assign(new URL(request.url), { method: request.method })

		if (method === 'POST' && pathname === '/api/create_company') {
			return run_with_connection(pool, async mysql => create_company(request, mysql))
		} else if (method === 'POST' && pathname === '/api/log_in') {
			return run_with_connection(pool, async mysql => log_in(request, mysql))
		} else if (pathname.startsWith('/api/fn/')) {
			return run_with_connection(pool, async mysql => {
				const session = await validate_session(request, mysql)
				if (!session) return error_response({ message: 'Unauthorized', status: 401 })
				return json_response({ body: { placeholder: true }, status: 200 })
			})
		}

		return env.ASSETS.fetch(request)
	},
} satisfies ExportedHandler<Env>
