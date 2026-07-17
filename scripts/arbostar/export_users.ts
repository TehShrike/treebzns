// Run-now export: pulls every ArboStar user account and writes arbostar_export/users.js.
//
//   node scripts/arbostar/export_users.ts
//
// Users don't live on a DataTables endpoint like the other modules. The list is
// POST /user/list_ajax with repeated `users_status_id[]` params (the sentinel -1 = "All";
// the named tabs are active/inactive/dismissed). The list rows are thin, so each user is
// enriched from GET /user/get/{id}, whose HTML embeds the full record as
// `window.UserFormConfig = {...};`.
//
// Auth comes from ./session.ts; the output shape is declared in
// arbostar_export/users.d.ts.

import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { map_with_concurrency } from './fetch_record.ts'
import { write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import type { ArbostarUser } from '#arbostar_export/users.d.ts'

type UserListRow = {
	id: number
}

type UserListResponse = {
	data: UserListRow[]
	statuses: Array<{ status_id: string | number; status_name: string; count: number }>
	recordsTotal: number
}

// The fields we consume from window.UserFormConfig (it holds many more — including
// emp_sin and MFA/credential config, which deliberately stay out of the export).
type UserFormConfig = {
	user_id: number
	user_type: string
	worker_type: number
	active_status: string
	active_employee: boolean
	firstname: string
	lastname: string
	full_name: string
	emailid: string
	user_email: string
	personal_email: string
	emp_phone: string
	extention_key: string
	emp_position: string
	emp_sex: string
	emp_birthday: string | null
	emp_date_hire: string | null
	emp_date_fired: string | null
	emp_yearly_rate: number
	emp_hourly_rate: number
	color: string
	address1: string
	address2: string
	city: string
	state: string
	user_zip: string
	user_country: string
	user_formatted_address: string
	user_lat: string
	user_lng: string
	internal_employee_id: number
	emp_custom_id: string
}

async function fetch_user_list(status_ids: string[]): Promise<UserListResponse> {
	const params = new URLSearchParams(status_ids.map(status_id => ['users_status_id[]', status_id]))
	const response = await fetch(`${BASE_URL}/user/list_ajax`, {
		method: 'POST',
		headers: {
			accept: 'application/json, text/javascript, */*; q=0.01',
			'x-requested-with': 'XMLHttpRequest',
			'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
			...AUTH_HEADERS,
		},
		body: params.toString(),
	})
	if (!response.ok) {
		throw new Error(`ArboStar /user/list_ajax failed: ${response.status} ${response.statusText}`)
	}
	return (await response.json()) as UserListResponse
}

// Same belt-and-suspenders approach as the DataTables modules: fetch the "All" sentinel,
// then every named status, and union by id — so a status the sentinel hides can't drop rows.
async function fetch_all_user_ids(): Promise<number[]> {
	const all_pass = await fetch_user_list(['-1'])
	const named_statuses = all_pass.statuses
		.map(status => status.status_id)
		.filter((id): id is string => typeof id === 'string')
	const named_pass = named_statuses.length > 0 ? await fetch_user_list(named_statuses) : { data: [] }

	const ids = new Set<number>()
	for (const row of [...all_pass.data, ...named_pass.data]) ids.add(row.id)
	return [...ids].sort((a, b) => a - b)
}

async function fetch_user_detail(user_id: number): Promise<UserFormConfig> {
	const response = await fetch(`${BASE_URL}/user/get/${user_id}`, {
		headers: { accept: 'text/html', ...AUTH_HEADERS },
	})
	if (!response.ok) {
		throw new Error(`ArboStar /user/get/${user_id} failed: ${response.status} ${response.statusText}`)
	}
	const html = await response.text()
	const anchor = 'window.UserFormConfig = '
	const start = html.indexOf(anchor)
	if (start === -1) {
		throw new Error(`ArboStar /user/get/${user_id}: no window.UserFormConfig found (stale session?)`)
	}
	const json_start = start + anchor.length
	const json_end = html.indexOf(';\n', json_start)
	return JSON.parse(html.slice(json_start, json_end)) as UserFormConfig
}

function to_user_export(config: UserFormConfig): ExportShape<ArbostarUser> {
	return {
		user_id: config.user_id,
		user_type: config.user_type,
		worker_type: config.worker_type,
		active_status: config.active_status,
		active_employee: config.active_employee,
		firstname: config.firstname,
		lastname: config.lastname,
		full_name: config.full_name,
		emailid: config.emailid,
		user_email: config.user_email,
		personal_email: config.personal_email,
		emp_phone: config.emp_phone,
		extention_key: config.extention_key,
		emp_position: config.emp_position,
		emp_sex: config.emp_sex,
		emp_birthday: config.emp_birthday,
		emp_date_hire: config.emp_date_hire,
		emp_date_fired: config.emp_date_fired,
		emp_yearly_rate: config.emp_yearly_rate,
		emp_hourly_rate: config.emp_hourly_rate,
		color: config.color,
		address1: config.address1,
		address2: config.address2,
		city: config.city,
		state: config.state,
		user_zip: config.user_zip,
		user_country: config.user_country,
		user_formatted_address: config.user_formatted_address,
		user_lat: config.user_lat,
		user_lng: config.user_lng,
		internal_employee_id: config.internal_employee_id,
		emp_custom_id: config.emp_custom_id,
	}
}

const user_ids = await fetch_all_user_ids()
console.log(`found ${user_ids.length} users`)

const users = await map_with_concurrency(
	user_ids,
	4,
	async user_id => to_user_export(await fetch_user_detail(user_id)),
	(done, total) => console.log(`  fetched ${done} / ${total} user details`),
)

console.log(`Wrote ${users.length} users -> ${write_output('users.js', users)}`)
