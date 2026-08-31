import { create_connection } from '#worker/lib/mysql/connection.ts'
import make_mysql_helpers_object, { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'

import create_company from './bare_endpoints/create_company.ts'
import log_in from './bare_endpoints/log_in.ts'
import log_out from './bare_endpoints/log_out.ts'
import session from './bare_endpoints/session.ts'
import server_functions from './bare_endpoints/server_functions.ts'
import { error_object_response } from './lib/response_helpers.ts'

const server_function_route_prefix = '/api/fn/'

const run_with_connection = async <RESULT>(env: Env, fn: (connection: MysqlHelpersObject) => Promise<RESULT>): Promise<RESULT> => {
	const conn = await create_connection(env.HYPERDRIVE)
	try {
		const mysql = make_mysql_helpers_object(conn)
		return await fn(mysql)
	} finally {
		await conn.end()
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname, method } = Object.assign(new URL(request.url), { method: request.method })

		try {
			if (method === 'POST' && pathname === '/api/create_company') {
				return run_with_connection(env, async mysql => create_company(request, mysql))
			} else if (method === 'POST' && pathname === '/api/log_in') {
				return run_with_connection(env, async mysql => log_in(request, mysql))
			} else if (method === 'POST' && pathname === '/api/log_out') {
				return run_with_connection(env, async mysql => log_out(request, mysql))
			} else if (method === 'GET' && pathname === '/api/session') {
				return run_with_connection(env, async mysql => session(request, mysql))
			} else if (method === 'POST' && pathname.startsWith(server_function_route_prefix)) {
				return run_with_connection(env, async mysql => server_functions(server_function_route_prefix, request, mysql))
			}
		} catch (error) {
			return error_object_response({ error })
		}

		return env.ASSETS.fetch(request)
	},
} satisfies ExportedHandler<Env>
