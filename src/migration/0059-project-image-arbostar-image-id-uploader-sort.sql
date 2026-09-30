ALTER TABLE project_image
	ADD COLUMN arbostar_image_id INT UNSIGNED,
	ADD COLUMN upload_employee_id INT UNSIGNED,
	ADD UNIQUE KEY uq_project_image_company_arbostar_image_id (company_id, arbostar_image_id);

ALTER TABLE project_line_item_image
	ADD COLUMN sort_order INT UNSIGNED NOT NULL DEFAULT 0;
