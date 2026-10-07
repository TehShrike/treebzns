ALTER TABLE project
	ADD COLUMN last_project_document_change_date date NULL AFTER project_document_id,
	ADD COLUMN last_project_document_change_datetime datetime NULL AFTER last_project_document_change_date,
	ADD KEY idx_project_company_last_document_change_date (company_id, last_project_document_change_date);

UPDATE project p
JOIN (
	SELECT project_id, change_date, change_datetime
	FROM (
		SELECT
			project_id,
			change_date,
			change_datetime,
			ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY change_datetime DESC, project_document_history_id DESC) AS recency
		FROM project_document_history
	) ranked
	WHERE recency = 1
) latest ON latest.project_id = p.project_id
SET
	p.last_project_document_change_date = latest.change_date,
	p.last_project_document_change_datetime = latest.change_datetime;
