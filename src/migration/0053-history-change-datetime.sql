ALTER TABLE clock_session_employee_history
	ADD COLUMN change_datetime datetime NULL AFTER change_date;

UPDATE clock_session_employee_history
SET change_datetime = created_at;

ALTER TABLE clock_session_employee_history
	MODIFY COLUMN change_datetime datetime NOT NULL;


ALTER TABLE crew_regular_history
	ADD COLUMN change_datetime datetime NULL AFTER change_date;

UPDATE crew_regular_history
SET change_datetime = created_at;

ALTER TABLE crew_regular_history
	MODIFY COLUMN change_datetime datetime NOT NULL;


ALTER TABLE project_document_history
	ADD COLUMN change_datetime datetime NULL AFTER change_date;

UPDATE project_document_history
SET change_datetime = created_at;

ALTER TABLE project_document_history
	MODIFY COLUMN change_datetime datetime NOT NULL;
