ALTER TABLE company
	ADD COLUMN round_line_item_estimates_to_nearest DECIMAL(10,2) NOT NULL DEFAULT 20.00 AFTER invoice_due_after_days;
