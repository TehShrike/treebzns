UPDATE project SET address_line_2 = '' WHERE address_line_2 IS NULL;
UPDATE project SET lead_details = '' WHERE lead_details IS NULL;
UPDATE project SET lead_source = '' WHERE lead_source IS NULL;
UPDATE project SET notes_for_crew = '' WHERE notes_for_crew IS NULL;
UPDATE project SET notes_for_office = '' WHERE notes_for_office IS NULL;

ALTER TABLE project
	MODIFY COLUMN address_line_2 VARCHAR(500) NOT NULL DEFAULT '',
	MODIFY COLUMN lead_details TEXT NOT NULL DEFAULT (''),
	MODIFY COLUMN lead_source VARCHAR(500) NOT NULL DEFAULT '',
	MODIFY COLUMN notes_for_crew TEXT NOT NULL DEFAULT (''),
	MODIFY COLUMN notes_for_office TEXT NOT NULL DEFAULT ('');

UPDATE client_contact SET phone = '' WHERE phone IS NULL;
UPDATE client_contact SET email = '' WHERE email IS NULL;

ALTER TABLE client_contact
	MODIFY COLUMN phone VARCHAR(30) NOT NULL DEFAULT '',
	MODIFY COLUMN email VARCHAR(500) NOT NULL DEFAULT '';
