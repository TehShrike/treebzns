ALTER TABLE employee
	ADD COLUMN login_name VARCHAR(200) AFTER email,
	MODIFY COLUMN email VARCHAR(500),
	ADD UNIQUE KEY uq_employee_company_login_name (company_id, login_name);
