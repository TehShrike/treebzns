ALTER TABLE project
	DROP KEY idx_project_company_last_document_change_date,
	ADD KEY idx_project_company_closed_last_document_change (company_id, closed, last_project_document_change_date);
