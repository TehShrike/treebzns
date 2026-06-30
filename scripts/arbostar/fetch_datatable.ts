// Generic ArboStar DataTables fetcher.
//
// Every ArboStar list screen (/clients, /leads, /estimates, /invoices, /workorders, ...)
// is backed by the same jQuery DataTables protocol: paginate via `start`/`length`, and the
// rows come back under `data.original` with the grand total in `recordsTotal`. The server
// validates that the ordered column is declared, so we always emit a single `columns[i]`
// definition matching `order[0][column]`. Module-specific filters (e.g. `status_ids[]=-1`
// to bypass the default status view) go in `extra_params`.
//
// Knows nothing about credentials, so it works in a browser on the arbostar origin (cookies
// sent automatically) or under node when you pass auth headers explicitly.

export type DataTableOrder = {
	/** The column index referenced by `order[0][column]`. */
	column_index: number
	/** The DB column name the server orders by (declared as `columns[i][name]`). */
	column_name: string
	dir?: 'asc' | 'desc'
}

export type FetchDataTableOptions = {
	/** Path under the origin, e.g. '/workorders'. */
	path: string
	/** Which column to order by — must be a real, orderable column for that module. */
	order: DataTableOrder
	/** Extra query params (module filters). String values, or arrays for repeated keys. */
	extra_params?: Record<string, string | string[]>
	base_url?: string
	/** Extra request headers (auth) merged over the DataTables defaults. */
	headers?: Record<string, string>
	/** Override the fetch implementation. Defaults to the global. */
	fetch_impl?: typeof fetch
	/** Rows per request. Defaults to 200. */
	page_size?: number
	/** Called after each page with the running total fetched and the grand total. */
	on_progress?: (fetched: number, total: number) => void
}

type DataTableResponse<Row> = {
	recordsTotal: number
	recordsFiltered: number
	data: { original: Row[] } | Row[]
	// Modules also return a `statuses` array (status tabs) alongside the rows.
	statuses?: Array<Record<string, unknown>>
}

function rows_of<Row>(body: DataTableResponse<Row>): Row[] {
	return Array.isArray(body.data) ? body.data : body.data.original
}

function build_params(options: FetchDataTableOptions, start: number, draw: number): URLSearchParams {
	const { order, page_size = 200 } = options
	const i = order.column_index
	const params = new URLSearchParams({
		draw: String(draw),
		start: String(start),
		length: String(page_size),
		[`columns[${i}][data]`]: String(i),
		[`columns[${i}][name]`]: order.column_name,
		[`columns[${i}][searchable]`]: 'true',
		[`columns[${i}][orderable]`]: 'true',
		[`columns[${i}][search][value]`]: '',
		[`columns[${i}][search][regex]`]: 'false',
		'order[0][column]': String(i),
		'order[0][dir]': order.dir ?? 'desc',
		'search[value]': '',
		'search[regex]': 'false',
	})
	for (const [key, value] of Object.entries(options.extra_params ?? {})) {
		if (Array.isArray(value)) {
			for (const v of value) params.append(key, v)
		} else {
			params.append(key, value)
		}
	}
	return params
}

async function fetch_page<Row>(
	options: FetchDataTableOptions,
	start: number,
	draw: number,
): Promise<DataTableResponse<Row>> {
	const base_url = options.base_url
	const fetch_impl = options.fetch_impl ?? fetch
	const params = build_params(options, start, draw)
	const response = await fetch_impl(`${base_url}${options.path}?${params.toString()}`, {
		credentials: 'include',
		headers: {
			accept: 'application/json, text/javascript, */*; q=0.01',
			'x-requested-with': 'XMLHttpRequest',
			'x-request-type': 'datatable',
			...options.headers,
		},
	})
	if (!response.ok) {
		throw new Error(
			`ArboStar ${options.path} request failed: ${response.status} ${response.statusText}`,
		)
	}
	return (await response.json()) as DataTableResponse<Row>
}

export async function fetch_all_rows<Row = unknown>(
	options: FetchDataTableOptions,
): Promise<Row[]> {
	const page_size = options.page_size ?? 200
	const all: Row[] = []
	let start = 0
	let draw = 1

	while (true) {
		const body = await fetch_page<Row>({ ...options, page_size }, start, draw)
		const page = rows_of(body)
		all.push(...page)

		options.on_progress?.(all.length, body.recordsTotal)

		if (page.length === 0 || all.length >= body.recordsTotal) break

		start += page_size
		draw += 1
	}

	return all
}

export type FetchEveryStatusOptions<Row> = Omit<FetchDataTableOptions, 'extra_params'> & {
	/** Field on each `statuses[]` entry holding its id, e.g. 'lead_status_id'. */
	status_id_field: string
	/** Stable per-row identity, used to de-duplicate across filter passes. */
	primary_key: (row: Row) => string | number
	/** Extra params merged into every request (besides the status filter). */
	extra_params?: Record<string, string | string[]>
}

// Each module's status tabs scope the list differently and inconsistently: for some, the
// "All" sentinel (status_ids[]=-1) returns the full history; for others (leads, invoices)
// it returns only an active subset and you must enumerate every status id to see the rest.
// To reliably get EVERYTHING we fetch both passes and union by primary key.
export async function fetch_all_rows_every_status<Row = unknown>(
	options: FetchEveryStatusOptions<Row>,
): Promise<Row[]> {
	const base = { ...options, extra_params: undefined as never }

	// Preflight one row to read the available status ids.
	const preflight = await fetch_page<Row>(
		{ ...base, page_size: 1, extra_params: { ...options.extra_params, 'status_ids[]': ['-1'] } },
		0,
		1,
	)
	const status_ids = (preflight.statuses ?? [])
		.map(status => status[options.status_id_field])
		.filter((id): id is number => typeof id === 'number' && id > 0)
		.map(String)

	const filter_passes: Array<string[]> = [['-1']]
	if (status_ids.length > 0) filter_passes.push(status_ids)

	const by_key = new Map<string | number, Row>()
	for (const status of filter_passes) {
		const seen_before = by_key.size
		const rows = await fetch_all_rows<Row>({
			...base,
			extra_params: { ...options.extra_params, 'status_ids[]': status },
			// Cumulative across passes (the per-module recordsTotal isn't meaningful here).
			on_progress: fetched => options.on_progress?.(seen_before + fetched, seen_before + fetched),
		})
		for (const row of rows) by_key.set(options.primary_key(row), row)
	}

	return [...by_key.values()]
}
