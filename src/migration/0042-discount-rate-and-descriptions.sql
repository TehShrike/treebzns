ALTER TABLE project
	ADD COLUMN discount_rate DECIMAL(5,4) AFTER taxable_subtotal,
	ADD COLUMN discount_description VARCHAR(200) NOT NULL DEFAULT '' AFTER discount;

ALTER TABLE invoice
	ADD COLUMN discount_rate DECIMAL(5,4) AFTER taxable_subtotal,
	ADD COLUMN discount_description VARCHAR(200) NOT NULL DEFAULT '' AFTER discount;

ALTER TABLE project_line_item
	ADD COLUMN discount_description VARCHAR(200) NOT NULL DEFAULT '' AFTER discount;

ALTER TABLE invoice_line_item
	ADD COLUMN discount_description VARCHAR(200) NOT NULL DEFAULT '' AFTER discount;
