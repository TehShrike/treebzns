-- 0008-employee-session-remove-expire-at.sql

ALTER TABLE employee_session
	DROP COLUMN expire_at;
