import { json_anything_response, error_response } from '#worker/lib/response_helpers.ts'
import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import validate_session from '#worker/lib/db/validate_session.ts'
import type { Context } from '#worker/lib/context.ts'
import type { Validator } from '#shared/json_validator.ts'
import globbed_server_functions from '../server_functions.generated.ts'
import { map } from '#shared/array.ts'
import object_to_entries from '#shared/object_to_entries.ts'
import { deserialize } from '#shared/json_anything.ts'

type ServerFunction = {
	validator: Validator<unknown>
	fn: (arg: unknown, context: Context) => Promise<unknown>
}

type ServerFunctionGlobbed = {
	path: string
	export: {
		name: string
		functions: Record<string, ServerFunction>
	}
}

const functions_by_name = new Map<string, ServerFunction>(
	globbed_server_functions.flatMap(globbed_server_function =>
		map(
			object_to_entries(globbed_server_function.export.functions),
			([name, endpoint]) => [name, endpoint]
		)
	)
)

type Session = NonNullable<Awaited<ReturnType<typeof validate_session>>>

type Argument = {
	function_name: string
	arg: unknown
	mysql: MysqlHelpersObject
	body_text: string
	session: Session
}

const call_server_function = async ({ function_name, arg, mysql, session }: Argument): Promise<Response> => {
	const server_function = functions_by_name.get(function_name)
	if (!server_function) {
		return error_response({ message: `No server function named "${function_name}"`, status: 404 })
	}

	if (!server_function.validator.is_valid(arg)) {
		return error_response({ message: server_function.validator.get_messages(arg, `${function_name}_arg`).join(', ') })
	}

	const context: Context = {
		user: session.employee,
		company: session.company,
		mysql,
	}

	const result = await server_function.fn(arg, context)

	return json_anything_response({ body: result, status: 200 })
}

export default async (server_function_route_prefix: string, request: Request, mysql: MysqlHelpersObject): Promise<Response> => {
	const { pathname } = new URL(request.url)
	const session = await validate_session(request, mysql)
	if (!session) return error_response({ message: 'Unauthorized', status: 401 })

	const function_name = decodeURIComponent(pathname.slice(server_function_route_prefix.length))
	const body_text = await request.text()

	let arg: unknown
	try {
		arg = body_text === '' ? undefined : deserialize(body_text)
	} catch {
		return error_response({ message: 'Request body is not valid' })
	}

	return call_server_function({ function_name, arg, body_text, mysql, session })
}
