ALTER TABLE project_line_item
	MODIFY COLUMN estimated_hours DECIMAL(10,2) DEFAULT NULL;

ALTER TABLE line_item_template
	MODIFY COLUMN estimated_hours DECIMAL(10,2) DEFAULT NULL;
