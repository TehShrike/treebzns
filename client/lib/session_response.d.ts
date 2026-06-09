import type { schema } from '#schema/constants.ts'

export type SessionResponse = {
	employee: Pick<DbEmployee, typeof schema.employee.employee_id | typeof schema.employee.company_id | typeof schema.employee.name | typeof schema.employee.email | typeof schema.employee.phone | typeof schema.employee.is_owner>
	company: Pick<DbCompany, typeof schema.company.company_id | typeof schema.company.name | typeof schema.company.brand_color | typeof schema.company.default_initial_project_document_id>
}
