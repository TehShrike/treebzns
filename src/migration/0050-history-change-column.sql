ALTER TABLE clock_session_employee_history
	ADD COLUMN `change` datetime NOT NULL DEFAULT (utc_timestamp()) AFTER changed_by_employee_id;


UPDATE clock_session_employee_history
SET `change` = created_at;


ALTER TABLE clock_session_employee_history
	ADD KEY idx_cseh_company_change (company_id, `change`);


ALTER TABLE crew_regular_history
	ADD COLUMN `change` datetime NOT NULL DEFAULT (utc_timestamp()) AFTER changed_by_employee_id;


UPDATE crew_regular_history
SET `change` = created_at;


ALTER TABLE crew_regular_history
	ADD KEY idx_crew_regular_history_company_change (company_id, `change`);


ALTER TABLE project_document_history
	ADD COLUMN `change` datetime NOT NULL DEFAULT (utc_timestamp()) AFTER changed_by_employee_id;


UPDATE project_document_history
SET `change` = created_at;


ALTER TABLE project_document_history
	ADD KEY idx_pdh_company_change (company_id, `change`);
