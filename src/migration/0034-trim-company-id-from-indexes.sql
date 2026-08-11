ALTER TABLE software_role_permission
	DROP PRIMARY KEY,
	ADD PRIMARY KEY (software_role_id, permission_id);

ALTER TABLE client
	DROP INDEX idx_client_company_tax_rate,
	ADD INDEX idx_client_tax_rate (tax_rate_id);

ALTER TABLE client_address
	DROP INDEX idx_client_address_company_client,
	ADD INDEX idx_client_address_client (client_id);

ALTER TABLE client_contact
	DROP INDEX idx_client_contact_company_client,
	ADD INDEX idx_client_contact_client (client_id);

ALTER TABLE employee_software_role
	DROP INDEX idx_esr_company_employee,
	DROP INDEX idx_esr_company_software_role,
	ADD INDEX idx_esr_employee (employee_id),
	ADD INDEX idx_esr_software_role (software_role_id);

ALTER TABLE crew_regular
	DROP PRIMARY KEY,
	DROP INDEX idx_crew_regular_company_employee,
	ADD PRIMARY KEY (crew_id, employee_id),
	ADD INDEX idx_crew_regular_employee (employee_id);

ALTER TABLE crew_regular_history
	DROP INDEX idx_crew_regular_history_company_crew,
	DROP INDEX idx_crew_regular_history_company_employee,
	ADD INDEX idx_crew_regular_history_crew (crew_id),
	ADD INDEX idx_crew_regular_history_employee (employee_id);

ALTER TABLE project
	DROP INDEX idx_project_company_client,
	ADD INDEX idx_project_client (client_id);

ALTER TABLE project_line_item
	DROP INDEX idx_pli_company_project,
	DROP INDEX idx_pli_company_item_type,
	DROP INDEX idx_pli_company_line_item_template,
	ADD INDEX idx_pli_project (project_id),
	ADD INDEX idx_pli_item_type (item_type_id),
	ADD INDEX idx_pli_line_item_template (line_item_template_id);

ALTER TABLE project_line_item_image
	DROP INDEX idx_plii_company_line_item,
	ADD INDEX idx_plii_line_item (project_line_item_id);

ALTER TABLE project_client_approval
	DROP INDEX idx_pca_company_employee,
	DROP INDEX idx_pca_company_project,
	ADD INDEX idx_pca_employee (added_by_employee_id),
	ADD INDEX idx_pca_project (project_id);

ALTER TABLE payment
	DROP INDEX idx_payment_company_client,
	ADD INDEX idx_payment_client (client_id);

ALTER TABLE payment_project
	DROP INDEX idx_payment_project_company_payment,
	DROP INDEX idx_payment_project_company_project,
	ADD INDEX idx_payment_project_payment (payment_id),
	ADD INDEX idx_payment_project_project (project_id);

ALTER TABLE time_entry
	DROP INDEX idx_time_entry_company_employee,
	DROP INDEX idx_time_entry_company_project,
	ADD INDEX idx_time_entry_employee_work_date (employee_id, work_date),
	ADD INDEX idx_time_entry_project (project_id);

ALTER TABLE estimate_availability
	DROP INDEX idx_estimate_availability_company_project,
	ADD INDEX idx_estimate_availability_project (project_id);

ALTER TABLE project_crew
	DROP INDEX idx_project_crew_company_project,
	DROP INDEX idx_project_crew_company_crew_work_date;

ALTER TABLE project_crew_employee
	DROP INDEX idx_project_crew_employee_company_employee,
	ADD INDEX idx_project_crew_employee_employee (employee_id);

ALTER TABLE project_crew_project_line_item
	DROP INDEX idx_pcpli_company_project_line_item,
	ADD INDEX idx_pcpli_project_line_item (project_line_item_id);

ALTER TABLE employee_work_skill
	DROP INDEX idx_employee_work_skill_company_work_skill,
	ADD INDEX idx_employee_work_skill_work_skill (work_skill_id);

ALTER TABLE project_line_item_work_skill
	DROP INDEX idx_pliws_company_work_skill,
	ADD INDEX idx_pliws_work_skill (work_skill_id);

ALTER TABLE line_item_template_work_skill
	DROP INDEX idx_litws_company_work_skill,
	ADD INDEX idx_litws_work_skill (work_skill_id);

ALTER TABLE project_image
	DROP INDEX idx_project_image_company_project,
	ADD INDEX idx_project_image_project (project_id);

ALTER TABLE project_document_history
	DROP INDEX idx_pdh_company_project,
	ADD INDEX idx_pdh_project (project_id);
