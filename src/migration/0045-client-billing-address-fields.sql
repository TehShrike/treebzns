ALTER TABLE client
	CHANGE COLUMN primary_client_address_id default_project_address_id INT UNSIGNED NOT NULL,
	DROP COLUMN billing_client_address_id,
	ADD COLUMN billing_name VARCHAR(500) NOT NULL DEFAULT '' AFTER default_project_address_id,
	ADD COLUMN billing_address_line_1 VARCHAR(500) NOT NULL DEFAULT '' AFTER billing_name,
	ADD COLUMN billing_address_line_2 VARCHAR(500) NOT NULL DEFAULT '' AFTER billing_address_line_1,
	ADD COLUMN billing_city VARCHAR(100) NOT NULL DEFAULT '' AFTER billing_address_line_2,
	ADD COLUMN billing_state VARCHAR(50) NOT NULL DEFAULT '' AFTER billing_city,
	ADD COLUMN billing_zip VARCHAR(20) NOT NULL DEFAULT '' AFTER billing_state;

ALTER TABLE invoice
	DROP COLUMN billing_name,
	DROP COLUMN billing_address_line_1,
	DROP COLUMN billing_address_line_2,
	DROP COLUMN billing_city,
	DROP COLUMN billing_state,
	DROP COLUMN billing_zip;

ALTER TABLE client_address
	ADD COLUMN client_contact_id INT UNSIGNED DEFAULT NULL AFTER client_id;
