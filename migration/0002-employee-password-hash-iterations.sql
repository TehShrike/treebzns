-- 0002-employee-password-hash-iterations.sql

ALTER TABLE employee
	ADD COLUMN number_of_password_hash_iterations INT UNSIGNED NOT NULL;
