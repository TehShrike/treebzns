UPDATE project_line_item_work_item
JOIN project_line_item ON project_line_item.project_line_item_id = project_line_item_work_item.project_line_item_id
SET project_line_item_work_item.work_details = project_line_item.description
WHERE project_line_item_work_item.work_details = '';

ALTER TABLE project_line_item
	DROP COLUMN description;

ALTER TABLE project_line_item_work_item
	RENAME COLUMN hourly_rate TO estimate_hourly_rate,
	ADD COLUMN product VARCHAR(200) NOT NULL DEFAULT '' AFTER work_type_id;


UPDATE work_type
SET hourly_rate = 100.00;

ALTER TABLE work_type
	MODIFY COLUMN hourly_rate DECIMAL(10,2) NOT NULL;


ALTER TABLE project
	DROP COLUMN estimated_crew_size;
