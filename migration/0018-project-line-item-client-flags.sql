ALTER TABLE project_line_item
	ADD COLUMN client_optional BIT(1) NOT NULL DEFAULT 0 AFTER taxable,
	ADD COLUMN client_declined BIT(1) NOT NULL DEFAULT 0 AFTER client_optional;
