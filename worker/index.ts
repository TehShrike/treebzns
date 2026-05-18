import { json_response, error_response } from './response_helpers.ts'
import { create_pool } from '#worker/lib/mysql/connection.ts'
import make_mysql_helpers_object from '#worker/lib/mysql/mysql_helpers_object.ts'
import { create_company } from '#worker/lib/create_company.ts'
import * as jv from '#shared/json_validator.ts'
import type { Pool } from 'mysql2/promise'

let pool: Pool | null = null

const create_company_validator = jv.object({
	company: jv.object({
		name: jv.is_string,
	}),
	owner_employee: jv.object({
		name: jv.is_string,
		email: jv.is_string,
		phone: jv.is_string,
		password: jv.is_string,
	}),
})

const new_company = async (request: Request, pool: Pool): Promise<Response> => {
	const body = await request.json().catch(() => null)
	if (!create_company_validator.is_valid(body)) {
		const messages = create_company_validator.get_messages(body, 'body')
		return error_response({ message: messages.join(', ') })
	}

	const conn = await pool.getConnection()
	try {
		const mysql = make_mysql_helpers_object(conn)
		const company_id = await create_company({
			name: body.company.name,
			logo: null,
			brand_color: null,
		}, body.owner_employee, mysql)
		return json_response({ body: { company_id: company_id.toString() }, status: 201 })
	} finally {
		conn.release()
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		pool ??= create_pool(env)
		const { pathname, method } = Object.assign(new URL(request.url), { method: request.method })

		if (method === 'POST' && pathname === '/api/create_company') {
			return new_company(request, pool)
		} else if (pathname.startsWith('/api/fn/')) {
			return json_response({ body: { placeholder: true }, status: 200 })
		}

		return env.ASSETS.fetch(request)
	},
} satisfies ExportedHandler<Env>
