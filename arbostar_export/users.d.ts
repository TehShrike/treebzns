// Shape of one element in arbostar_export/users.js (see export_users.ts).
// One row per ArboStar user account (the people who log in — estimators, office staff,
// field workers). Merged from the /user/list_ajax list row and the richer JSON embedded
// in each /user/get/{id} page. Deliberately excluded: emp_sin, MFA/credential fields,
// pictures, permission config, and payroll integration flags.
// Unions enumerate the values observed in the July 2026 export (see estimates.d.ts).
export type ArbostarUser = {
	user_id: number
	user_type: 'admin' | 'user'
	/** 1 = field worker, 2 = office (the user list's "field workers" filter matches 1). */
	worker_type: 1 | 2
	/** 'yes' = active. The list page's status tabs are active/inactive/dismissed, so other values likely exist. */
	active_status: 'yes' | 'suspended'
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
	/** Free-entry job title. */
	emp_position: string
	emp_sex: 'male' | 'female'
	/** MM/DD/YYYY. */
	emp_birthday: string | null
	/** Present in the API but never populated in the export. */
	emp_date_hire: null
	/** MM/DD/YYYY. */
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
	/** '' on one account (API quirk); otherwise a number. */
	internal_employee_id: number | ''
	emp_custom_id: string
	/** ArboStar's employee record id. Each user has one. */
	employee_id: number
	/** 'employee' in every row. */
	emp_type: string
	/** The "Field Estimator" checkbox. */
	field_estimator: boolean
	/** The "Field Worker" checkbox. */
	field_worker: boolean
	/** ArboStar's is_default_estimator. false for every user so far. */
	default_estimator: boolean
	/** ArboStar's is_appointment. The meaning is not verified. */
	appointments: boolean
	/** ArboStar's is_tracked. The meaning is not verified. */
	tracked: boolean
	/** false for every user so far. */
	crew_leader: boolean
	/** Crew skill checkboxes on the employee record. false for every user so far. */
	driver: boolean
	climber: boolean
	ground: boolean
	technique: boolean
	/** e.g. 'current'. */
	emp_status: string
	/** e.g. 'weekly'; '' when unset. */
	emp_pay_frequency: string
	/** Work day start; '' for every user so far. */
	emp_start_time: string
	/** Work day end; '' for every user so far. */
	emp_end_time: string
	/** License number; '' for every user so far. */
	emp_license_no: string
	/** ISO instant (UTC) the user account was created. */
	added_on: string | null
	/** ISO instant (UTC) the user account last changed. */
	updated_on: string | null
	/** ISO instant (UTC). */
	last_login: string | null
}

// users.js is an ESM module whose default export is the full array of records.
declare const users: ArbostarUser[]
export default users
