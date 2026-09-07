ALTER TABLE client
	RENAME COLUMN primary_phone TO billing_phone,
	RENAME COLUMN primary_email TO billing_email;
