ALTER TABLE project_document
	ADD COLUMN declined BIT(1) NOT NULL DEFAULT 0 AFTER represents_billable_sale_when_closed,
	ADD COLUMN closed_by_default BIT(1) NOT NULL DEFAULT 0 AFTER declined,
	ADD COLUMN declined_project_document_id INT UNSIGNED AFTER closed_by_default;

UPDATE project_document SET closed_by_default = 1, sort = 9 WHERE name = 'Void';

UPDATE project_document SET name = 'Proposal' WHERE name = 'Estimate';

INSERT INTO project_document (name, sort, declined, closed_by_default)
	VALUES ('Declined Proposal', 7, 1, 1);
SET @declined_proposal_id = LAST_INSERT_ID();

INSERT INTO project_document (name, sort, declined, closed_by_default)
	VALUES ('Cancelled Work Order', 8, 1, 1);
SET @cancelled_work_order_id = LAST_INSERT_ID();

UPDATE project_document SET declined_project_document_id = @declined_proposal_id WHERE name = 'Proposal';
UPDATE project_document SET declined_project_document_id = @cancelled_work_order_id WHERE should_be_worked = 1;

CREATE TABLE project_decline_reason (
	project_decline_reason_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	reason VARCHAR(200) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_decline_reason_id),
	UNIQUE KEY uq_project_decline_reason_company_reason (company_id, reason)
) ENGINE=InnoDB;

INSERT INTO project_decline_reason (company_id, reason)
SELECT company.company_id, defaults.reason
FROM company
CROSS JOIN (
	SELECT 'Price too high' AS reason
	UNION ALL SELECT 'Went with a lower bid'
	UNION ALL SELECT 'Weren''t pleased'
	UNION ALL SELECT 'Didn''t like credentials'
	UNION ALL SELECT 'Scheduling troubles'
	UNION ALL SELECT 'Financial troubles'
) defaults;

ALTER TABLE project
	ADD COLUMN project_decline_reason_id INT UNSIGNED AFTER closed_date;
