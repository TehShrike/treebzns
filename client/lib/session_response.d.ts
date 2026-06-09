import type { employee, company } from '#schema/constants.ts'

export type SessionResponse = {
	employee: Pick<DbEmployee, typeof employee.employee_id | typeof employee.company_id | typeof employee.name | typeof employee.email | typeof employee.phone | typeof employee.is_owner>
	company: Pick<DbCompany, typeof company.company_id | typeof company.name | typeof company.brand_color | typeof company.default_initial_project_document_id>
}
