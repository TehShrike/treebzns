export const session_employee_columns = [`employee_id`, `company_id`, `name`, `email`, `login_name`, `phone`, `is_owner`] as const
export const session_company_columns = [`company_id`, `name`, `brand_color`, `timezone`] as const

export type LoggedInSession = {
	logged_in: true
	employee: Pick<DbEmployee, (typeof session_employee_columns)[number]>
	company: Pick<DbCompany, (typeof session_company_columns)[number]>
}

export type SessionResponse = LoggedInSession | {
	logged_in: false
}
