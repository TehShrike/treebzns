import { create_pool } from '#worker/lib/mysql/connection.ts'
import make_mysql_helpers_object, { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import type { Pool } from 'mysql2/promise'

import create_company from './bare_endpoints/create_company.ts'
import log_in from './bare_endpoints/log_in.ts'
import get_session from './bare_endpoints/session.ts'
import server_functions from './bare_endpoints/server_functions.ts'

const server_function_route_prefix = '/api/fn/'

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
		} else if (method === 'GET' && pathname === '/api/session') {
			return run_with_connection(pool, async mysql => get_session(request, mysql))
		} else if (method === 'POST' && pathname.startsWith(server_function_route_prefix)) {
			return run_with_connection(pool, async mysql => server_functions(server_function_route_prefix, request, mysql))
		}

		return env.ASSETS.fetch(request)
	},
} satisfies ExportedHandler<Env>
