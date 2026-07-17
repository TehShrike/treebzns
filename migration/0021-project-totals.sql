ALTER TABLE project
	ADD COLUMN subtotal DECIMAL(10,2) AFTER tax_rate,
	ADD COLUMN tax_total DECIMAL(10,2) AFTER subtotal,
	ADD COLUMN total DECIMAL(10,2) AFTER tax_total;
