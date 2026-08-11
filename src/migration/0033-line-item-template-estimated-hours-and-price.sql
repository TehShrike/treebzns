ALTER TABLE line_item_template
	ADD COLUMN estimated_hours INT UNSIGNED AFTER title,
	ADD COLUMN price DECIMAL(10,2) AFTER estimated_hours;
