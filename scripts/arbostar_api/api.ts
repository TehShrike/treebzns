import assert from '#shared/assert.ts'
import { for_each } from '#shared/array.ts'

const base_url = process.env.ARBOSTAR_BASE_URL
const token = process.env.ARBOSTAR_API_ACCESS_TOKEN
assert(base_url, 'ARBOSTAR_BASE_URL is set in .env (run with pnpm exec dotenv --)')
assert(token, 'ARBOSTAR_API_ACCESS_TOKEN is set in .env (run with pnpm exec dotenv --)')

export type Params = Record<string, string | number | readonly (string | number)[]>

const to_query_string = (params: Params) => {
	const search = new URLSearchParams()
	for_each(Object.entries(params), ([key, value]) => {
		if (typeof value === 'object') {
			for_each(value, item => search.append(`${key}[]`, String(item)))
		} else {
			search.append(key, String(value))
		}
	})
	return search.toString()
}

export const request_json = async <Body>(method: 'GET' | 'POST', path: string, params: Params = {}): Promise<Body> => {
	const query_string = to_query_string(params)
	const response = await fetch(`${base_url}${path}${query_string ? `?${query_string}` : ''}`, {
		method,
		headers: {
			authorization: `Bearer ${token}`,
			accept: 'application/json',
		},
	})
	const text = await response.text()
	assert(response.ok, `${method} ${path} responds ok — got ${response.status}: ${text.slice(0, 300)}`)
	const body = JSON.parse(text) as Body & { status?: unknown }
	assert(body.status === 'ok', `${method} ${path} responds with status ok — got ${text.slice(0, 300)}`)
	return body
}

type OffsetPage<Row> = {
	data: Row[]
	total_rows?: number
	total?: number
	meta?: { total: number }
}

export const fetch_offset_pages = async <Row>({
	label,
	method = 'GET',
	path,
	page_size,
	params = {},
	id_of,
}: {
	label: string
	method?: 'GET' | 'POST'
	path: string
	page_size: number
	params?: Params
	id_of: (row: Row) => number
}): Promise<Row[]> => {
	const rows_by_id = new Map<number, Row>()
	let offset = 0
	let total = Infinity
	while (offset < total) {
		const page = await request_json<OffsetPage<Row>>(method, path, { ...params, offset, limit: page_size })
		const page_total = page.total_rows ?? page.total ?? page.meta?.total
		assert(page_total !== undefined, `${path} reports a total row count`)
		total = page_total
		for_each(page.data, row => rows_by_id.set(id_of(row), row))
		offset += page_size
		console.log(`[${label}] ${rows_by_id.size}/${total}`)
		if (page.data.length === 0) {
			break
		}
	}
	assert(rows_by_id.size === total, `${path} returns ${total} distinct rows — got ${rows_by_id.size}`)
	return [...rows_by_id.values()]
}
