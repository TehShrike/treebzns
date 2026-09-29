export type ArbostarApiWorkedTime = {
	worked_user_id: number
	worked_id: number
	worked_date: string
	worked_hours: number
	worked_lunch: number | null
	travel_time: number
	worked_start: string
	worked_end: string | null
	expense_user_id: number | null
	bld_expense_value: string | null
	expense_date: string | null
	extra_expense_value: string | null
	updated_at: string
	created_at: string
}

/** From /api/v1/trackers. */
export type ArbostarApiUser = {
	id: number
	/** Login username */
	emailid: string
	firstname: string
	lastname: string
	active_status: string
	user_email: string | null
	user_active_employee: boolean
	user_emp_id: number
	full_name: string
	initials: string
	employee_worked: ArbostarApiWorkedTime[]
}

declare const users: ArbostarApiUser[]
export default users
