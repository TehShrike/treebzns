ALTER TABLE project_line_item
	ADD COLUMN estimated_crew_size TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER line_item_template_id;
