ALTER TABLE client_contact
	RENAME COLUMN contact_name TO name,
	ADD COLUMN description VARCHAR(200) NOT NULL DEFAULT '' AFTER client_id,
	ADD COLUMN arbostar_email_data JSON AFTER email;
