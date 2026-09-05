export type SessionResponse = {
	employee: Pick<DbEmployee, 'employee_id' | 'company_id' | 'name' | 'email' | 'login_name' | 'phone' | 'is_owner'>
	company: Pick<DbCompany, 'company_id' | 'name' | 'brand_color' | 'timezone'>
}
