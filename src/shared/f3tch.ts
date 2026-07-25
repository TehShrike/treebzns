import { deserialize, serialize } from '#shared/json_anything.ts'

export default async function f3tch(url: string, options: Omit<RequestInit, 'body'> & { body?: unknown } = {}) {
	const headers_override = options.body ? { 'Content-Type': 'application/json_anything' } : {}
	const body = options.body ? serialize(options.body) : null
	const res = await fetch(url, {
		...options,
		headers: { ...options.headers, ...headers_override },
		body,
	})

	const response_text = await res.text()

	let response_json: any = null

	if (res.headers.get('Content-Type')?.startsWith('application/json_anything')) {
		response_json = deserialize(response_text)
	} else if (res.headers.get('Content-Type')?.startsWith('application/json')) {
		response_json = JSON.parse(response_text)
	}

	if (!res.ok) {
		return Promise.reject({ res, body: response_json, text: response_text })
	}

	return response_json
}
