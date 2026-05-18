-- 0005-employee-phone-not-null.sql

ALTER TABLE employee
	MODIFY COLUMN phone VARCHAR(30) NOT NULL DEFAULT '';
