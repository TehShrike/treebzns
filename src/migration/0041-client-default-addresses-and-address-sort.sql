ALTER TABLE client
	CHANGE COLUMN primary_client_address_id default_project_address_id INT UNSIGNED,
	CHANGE COLUMN billing_client_address_id default_billing_address_id INT UNSIGNED;

UPDATE client SET default_project_address_id = NULL WHERE default_project_address_id = 0;

ALTER TABLE client_address
	ADD COLUMN sort_order SMALLINT NOT NULL DEFAULT 0 AFTER email;

UPDATE client_address
JOIN (
	SELECT client_address_id, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY client_address_id) - 1 AS n
	FROM client_address
) numbered ON numbered.client_address_id = client_address.client_address_id
SET client_address.sort_order = numbered.n;
