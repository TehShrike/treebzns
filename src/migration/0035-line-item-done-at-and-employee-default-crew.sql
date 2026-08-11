ALTER TABLE project_line_item
	ADD COLUMN done_at DATETIME AFTER price;

ALTER TABLE employee
	ADD COLUMN default_crew_id INT UNSIGNED;
