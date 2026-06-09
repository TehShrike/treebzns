ALTER TABLE project_document
	DROP INDEX idx_project_document_company_next,
	DROP COLUMN company_id,
	DROP COLUMN group_name,
	ADD COLUMN sort TINYINT UNSIGNED NOT NULL DEFAULT 0;

INSERT INTO project_document (name, sort, should_be_worked, can_be_closed, represents_billable_sale_when_closed)
	VALUES ('Work Order', 4, 1, 1, 1);
SET @work_order_id = LAST_INSERT_ID();

INSERT INTO project_document (name, sort, needs_client_approval_to_move_on, can_expire, next_project_document_id)
	VALUES ('Estimate', 3, 1, 1, @work_order_id);
SET @estimate_id = LAST_INSERT_ID();

INSERT INTO project_document (name, sort, needs_estimate_to_move_on, next_project_document_id)
	VALUES ('Lead (Qualified)', 2, 1, @estimate_id);
SET @lead_qualified_id = LAST_INSERT_ID();

INSERT INTO project_document (name, sort, needs_to_be_contacted_by_lead_qualifier, next_project_document_id)
	VALUES ('Lead (Unqualified)', 1, 1, @lead_qualified_id);

INSERT INTO project_document (name, sort, should_be_worked, can_be_closed)
	VALUES ('Work Order (Errand)', 5, 1, 1);

INSERT INTO project_document (name, sort, should_be_worked, can_be_closed)
	VALUES ('Work Order (Customer Sat)', 6, 1, 1);

INSERT INTO project_document (name, sort)
	VALUES ('Void', 7);
