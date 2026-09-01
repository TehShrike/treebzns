ALTER TABLE clock_session_employee_history
	DROP KEY idx_cseh_company_change,
	ADD COLUMN change_date date NULL AFTER changed_by_employee_id;


UPDATE clock_session_employee_history
SET change_date = DATE(`change`);


ALTER TABLE clock_session_employee_history
	DROP COLUMN `change`,
	MODIFY change_date date NOT NULL,
	ADD KEY idx_cseh_company_change_date (company_id, change_date);


ALTER TABLE crew_regular_history
	DROP KEY idx_crew_regular_history_company_change,
	ADD COLUMN change_date date NULL AFTER changed_by_employee_id;


UPDATE crew_regular_history
SET change_date = DATE(`change`);


ALTER TABLE crew_regular_history
	DROP COLUMN `change`,
	MODIFY change_date date NOT NULL,
	ADD KEY idx_crew_regular_history_company_change_date (company_id, change_date);


ALTER TABLE project_document_history
	DROP KEY idx_pdh_company_change,
	ADD COLUMN change_date date NULL AFTER changed_by_employee_id;


UPDATE project_document_history
SET change_date = DATE(`change`);


ALTER TABLE project_document_history
	DROP COLUMN `change`,
	MODIFY change_date date NOT NULL,
	ADD KEY idx_pdh_company_change_date (company_id, change_date);
