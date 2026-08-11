import type { InsertableSchema, Schema } from './types.ts'
import type { Validator } from '#shared/json_validator.ts'
import { client_validator, insertable_client_validator } from './validator/client.ts'
import { client_address_validator, insertable_client_address_validator } from './validator/client_address.ts'
import { client_contact_validator, insertable_client_contact_validator } from './validator/client_contact.ts'
import { company_validator, insertable_company_validator } from './validator/company.ts'
import { crew_validator, insertable_crew_validator } from './validator/crew.ts'
import { crew_regular_validator, insertable_crew_regular_validator } from './validator/crew_regular.ts'
import { crew_regular_history_validator, insertable_crew_regular_history_validator } from './validator/crew_regular_history.ts'
import { employee_validator, insertable_employee_validator } from './validator/employee.ts'
import { employee_session_validator, insertable_employee_session_validator } from './validator/employee_session.ts'
import { employee_software_role_validator, insertable_employee_software_role_validator } from './validator/employee_software_role.ts'
import { employee_work_skill_validator, insertable_employee_work_skill_validator } from './validator/employee_work_skill.ts'
import { estimate_availability_validator, insertable_estimate_availability_validator } from './validator/estimate_availability.ts'
import { item_type_validator, insertable_item_type_validator } from './validator/item_type.ts'
import { line_item_template_validator, insertable_line_item_template_validator } from './validator/line_item_template.ts'
import { line_item_template_work_skill_validator, insertable_line_item_template_work_skill_validator } from './validator/line_item_template_work_skill.ts'
import { migration_validator, insertable_migration_validator } from './validator/migration.ts'
import { payment_validator, insertable_payment_validator } from './validator/payment.ts'
import { payment_method_validator, insertable_payment_method_validator } from './validator/payment_method.ts'
import { payment_project_validator, insertable_payment_project_validator } from './validator/payment_project.ts'
import { permission_validator, insertable_permission_validator } from './validator/permission.ts'
import { project_validator, insertable_project_validator } from './validator/project.ts'
import { project_client_approval_validator, insertable_project_client_approval_validator } from './validator/project_client_approval.ts'
import { project_crew_validator, insertable_project_crew_validator } from './validator/project_crew.ts'
import { project_crew_employee_validator, insertable_project_crew_employee_validator } from './validator/project_crew_employee.ts'
import { project_crew_project_line_item_validator, insertable_project_crew_project_line_item_validator } from './validator/project_crew_project_line_item.ts'
import { project_decline_reason_validator, insertable_project_decline_reason_validator } from './validator/project_decline_reason.ts'
import { project_document_validator, insertable_project_document_validator } from './validator/project_document.ts'
import { project_document_history_validator, insertable_project_document_history_validator } from './validator/project_document_history.ts'
import { project_image_validator, insertable_project_image_validator } from './validator/project_image.ts'
import { project_line_item_validator, insertable_project_line_item_validator } from './validator/project_line_item.ts'
import { project_line_item_image_validator, insertable_project_line_item_image_validator } from './validator/project_line_item_image.ts'
import { project_line_item_work_skill_validator, insertable_project_line_item_work_skill_validator } from './validator/project_line_item_work_skill.ts'
import { project_number_validator, insertable_project_number_validator } from './validator/project_number.ts'
import { software_role_validator, insertable_software_role_validator } from './validator/software_role.ts'
import { software_role_permission_validator, insertable_software_role_permission_validator } from './validator/software_role_permission.ts'
import { tax_rate_validator, insertable_tax_rate_validator } from './validator/tax_rate.ts'
import { time_entry_validator, insertable_time_entry_validator } from './validator/time_entry.ts'
import { work_skill_validator, insertable_work_skill_validator } from './validator/work_skill.ts'

export const validators = {
	client: client_validator,
	client_address: client_address_validator,
	client_contact: client_contact_validator,
	company: company_validator,
	crew: crew_validator,
	crew_regular: crew_regular_validator,
	crew_regular_history: crew_regular_history_validator,
	employee: employee_validator,
	employee_session: employee_session_validator,
	employee_software_role: employee_software_role_validator,
	employee_work_skill: employee_work_skill_validator,
	estimate_availability: estimate_availability_validator,
	item_type: item_type_validator,
	line_item_template: line_item_template_validator,
	line_item_template_work_skill: line_item_template_work_skill_validator,
	migration: migration_validator,
	payment: payment_validator,
	payment_method: payment_method_validator,
	payment_project: payment_project_validator,
	permission: permission_validator,
	project: project_validator,
	project_client_approval: project_client_approval_validator,
	project_crew: project_crew_validator,
	project_crew_employee: project_crew_employee_validator,
	project_crew_project_line_item: project_crew_project_line_item_validator,
	project_decline_reason: project_decline_reason_validator,
	project_document: project_document_validator,
	project_document_history: project_document_history_validator,
	project_image: project_image_validator,
	project_line_item: project_line_item_validator,
	project_line_item_image: project_line_item_image_validator,
	project_line_item_work_skill: project_line_item_work_skill_validator,
	project_number: project_number_validator,
	software_role: software_role_validator,
	software_role_permission: software_role_permission_validator,
	tax_rate: tax_rate_validator,
	time_entry: time_entry_validator,
	work_skill: work_skill_validator,
} satisfies { [TABLE in keyof Schema]: Validator<Schema[TABLE]> }

export const insertable_validators = {
	client: insertable_client_validator,
	client_address: insertable_client_address_validator,
	client_contact: insertable_client_contact_validator,
	company: insertable_company_validator,
	crew: insertable_crew_validator,
	crew_regular: insertable_crew_regular_validator,
	crew_regular_history: insertable_crew_regular_history_validator,
	employee: insertable_employee_validator,
	employee_session: insertable_employee_session_validator,
	employee_software_role: insertable_employee_software_role_validator,
	employee_work_skill: insertable_employee_work_skill_validator,
	estimate_availability: insertable_estimate_availability_validator,
	item_type: insertable_item_type_validator,
	line_item_template: insertable_line_item_template_validator,
	line_item_template_work_skill: insertable_line_item_template_work_skill_validator,
	migration: insertable_migration_validator,
	payment: insertable_payment_validator,
	payment_method: insertable_payment_method_validator,
	payment_project: insertable_payment_project_validator,
	permission: insertable_permission_validator,
	project: insertable_project_validator,
	project_client_approval: insertable_project_client_approval_validator,
	project_crew: insertable_project_crew_validator,
	project_crew_employee: insertable_project_crew_employee_validator,
	project_crew_project_line_item: insertable_project_crew_project_line_item_validator,
	project_decline_reason: insertable_project_decline_reason_validator,
	project_document: insertable_project_document_validator,
	project_document_history: insertable_project_document_history_validator,
	project_image: insertable_project_image_validator,
	project_line_item: insertable_project_line_item_validator,
	project_line_item_image: insertable_project_line_item_image_validator,
	project_line_item_work_skill: insertable_project_line_item_work_skill_validator,
	project_number: insertable_project_number_validator,
	software_role: insertable_software_role_validator,
	software_role_permission: insertable_software_role_permission_validator,
	tax_rate: insertable_tax_rate_validator,
	time_entry: insertable_time_entry_validator,
	work_skill: insertable_work_skill_validator,
} satisfies { [TABLE in keyof InsertableSchema]: Validator<InsertableSchema[TABLE]> }
