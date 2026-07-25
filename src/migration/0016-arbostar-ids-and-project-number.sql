ALTER TABLE project
	ADD COLUMN number INT UNSIGNED AFTER project_document_id;

UPDATE project
JOIN (
	SELECT project_id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY project_id) AS n
	FROM project
) numbered ON numbered.project_id = project.project_id
SET project.number = numbered.n;

ALTER TABLE project
	MODIFY COLUMN number INT UNSIGNED NOT NULL,
	ADD UNIQUE KEY uq_project_company_number (company_id, number);

INSERT INTO project_number (company_id, last_number)
SELECT company.company_id, COALESCE(MAX(project.number), 0)
FROM company
LEFT JOIN project ON project.company_id = company.company_id
GROUP BY company.company_id;

ALTER TABLE employee
	ADD COLUMN arbostar_user_id INT UNSIGNED,
	ADD UNIQUE KEY uq_employee_company_arbostar_user_id (company_id, arbostar_user_id);

ALTER TABLE client
	ADD COLUMN arbostar_client_id INT UNSIGNED,
	ADD UNIQUE KEY uq_client_company_arbostar_client_id (company_id, arbostar_client_id);

ALTER TABLE payment
	ADD COLUMN arbostar_invoice_id INT UNSIGNED,
	ADD UNIQUE KEY uq_payment_company_arbostar_invoice_id (company_id, arbostar_invoice_id);

ALTER TABLE client_contact
	ADD COLUMN arbostar_contact_id INT UNSIGNED,
	ADD UNIQUE KEY uq_client_contact_company_arbostar_contact_id (company_id, arbostar_contact_id);

ALTER TABLE project_line_item
	ADD COLUMN arbostar_line_item_id INT UNSIGNED,
	ADD UNIQUE KEY uq_project_line_item_company_arbostar_line_item_id (company_id, arbostar_line_item_id);
