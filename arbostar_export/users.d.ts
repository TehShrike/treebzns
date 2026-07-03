// Shape of one element in arbostar_export/users.js (see export_users.ts).
// One row per ArboStar user account (the people who log in — estimators, office staff,
// field workers). Merged from the /user/list_ajax list row and the richer JSON embedded
// in each /user/get/{id} page. Deliberately excluded: emp_sin, MFA/credential fields,
// pictures, permission config.
export type ArbostarUser = {
	user_id: number
	/** 'admin' | 'user' */
	user_type: string
	/** 1 = field worker, 2 = office (the user list's "field workers" filter matches 1). */
	worker_type: number
	/** 'yes' (active) | 'suspended' | ... (the list page's status tabs are active/inactive/dismissed). */
	active_status: string
	active_employee: boolean
	firstname: string
	lastname: string
	full_name: string
	/** Login username (not an email address). */
	emailid: string
	/** Login/notification email address. */
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
	/** Calendar/map pin color, e.g. '#a0a0a0'. */
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

// users.js is an ESM module whose default export is the full array of records.
declare const users: ArbostarUser[]
export default users
