ALTER TABLE employee
	DROP INDEX uq_employee_company_email,
	DROP INDEX uq_employee_company_login_name,
	ADD UNIQUE KEY uq_employee_email (email),
	ADD UNIQUE KEY uq_employee_login_name (login_name);
