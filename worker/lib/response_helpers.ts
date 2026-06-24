import { serialize } from '#shared/json_anything.ts'

export const response = ({
	body = null,
	status,
	headers = {},
}: {
	body?: string | null
	status: number
	headers?: Record<string, string>
}) =>
	new Response(body, {
		status,
		headers: { /* ...cors_headers, */ ...headers },
	})

export const json_response = ({
	body,
	status,
	headers = {},
}: {
	body: any
	status: number
	headers?: Record<string, string>
}) =>
	response({
		body: JSON.stringify(body),
		status,
		headers: { 'Content-Type': 'application/json', ...headers },
	})

export const json_anything_response = ({
	body,
	status,
	headers = {},
}: {
	body: unknown
	status: number
	headers?: Record<string, string>
}) =>
	response({
		body: serialize(body),
		status,
		headers: { 'Content-Type': 'application/json_anything', ...headers },
	})

export const error_object_response = ({ error }: { error: unknown }) => {
	const status = 500
	if (error instanceof Error) {
		return json_response({ body: { error: error.message, stack: error.stack }, status })
	} else if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
		return json_response({ body: { error: error.message, stack: null }, status })
	} else {
		return json_response({ body: { error: JSON.stringify(error), stack: null }, status })
	}
}

export const error_response = ({
	message,
	status = 400,
	headers = {},
	stack
}: {
	message: string
	status?: number
	headers?: Record<string, string>
	stack?: string
}) =>
	json_response({
		body: { error: message, stack },
		status,
		headers,
	})
