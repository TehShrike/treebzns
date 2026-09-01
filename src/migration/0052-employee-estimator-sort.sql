ALTER TABLE employee
	ADD COLUMN estimator_sort SMALLINT UNSIGNED AFTER phone;

UPDATE employee
JOIN (
	SELECT employee_id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY employee_id) - 1 AS n
	FROM employee
) numbered ON numbered.employee_id = employee.employee_id
SET employee.estimator_sort = numbered.n;

ALTER TABLE employee
	MODIFY COLUMN estimator_sort SMALLINT UNSIGNED NOT NULL;
