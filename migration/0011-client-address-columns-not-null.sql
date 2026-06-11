UPDATE client_address SET address_line_2 = '' WHERE address_line_2 IS NULL;
UPDATE client_address SET contact = '' WHERE contact IS NULL;
UPDATE client_address SET phone = '' WHERE phone IS NULL;
UPDATE client_address SET email = '' WHERE email IS NULL;

ALTER TABLE client_address
	MODIFY COLUMN address_line_2 VARCHAR(500) NOT NULL DEFAULT '',
	MODIFY COLUMN contact VARCHAR(500) NOT NULL DEFAULT '',
	MODIFY COLUMN phone VARCHAR(50) NOT NULL DEFAULT '',
	MODIFY COLUMN email VARCHAR(500) NOT NULL DEFAULT '';
