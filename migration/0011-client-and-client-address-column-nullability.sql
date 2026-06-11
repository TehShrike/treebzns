UPDATE client_address SET address_line_2 = '' WHERE address_line_2 IS NULL;
UPDATE client_address SET contact = '' WHERE contact IS NULL;
UPDATE client_address SET phone = '' WHERE phone IS NULL;
UPDATE client_address SET email = '' WHERE email IS NULL;

ALTER TABLE client_address
	MODIFY COLUMN address_line_2 VARCHAR(500) NOT NULL DEFAULT '',
	MODIFY COLUMN contact VARCHAR(500) NOT NULL DEFAULT '',
	MODIFY COLUMN phone VARCHAR(50) NOT NULL DEFAULT '',
	MODIFY COLUMN email VARCHAR(500) NOT NULL DEFAULT '';

UPDATE client SET primary_phone = '' WHERE primary_phone IS NULL;
UPDATE client SET primary_email = '' WHERE primary_email IS NULL;
UPDATE client SET notes = '' WHERE notes IS NULL;
UPDATE client SET referred_by = '' WHERE referred_by IS NULL;

ALTER TABLE client
	MODIFY COLUMN primary_phone VARCHAR(30) NOT NULL DEFAULT '',
	MODIFY COLUMN primary_email VARCHAR(500) NOT NULL DEFAULT '',
	MODIFY COLUMN notes TEXT NOT NULL DEFAULT (''),
	MODIFY COLUMN referred_by VARCHAR(500) NOT NULL DEFAULT '',
	MODIFY COLUMN billing_client_address_id INT UNSIGNED;
