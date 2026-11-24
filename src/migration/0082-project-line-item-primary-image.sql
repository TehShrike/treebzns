ALTER TABLE project_line_item
	ADD COLUMN primary_image_id INT UNSIGNED DEFAULT NULL AFTER sort;

UPDATE project_line_item
SET primary_image_id = (
	SELECT project_line_item_image.project_image_id
	FROM project_line_item_image
	WHERE project_line_item_image.project_line_item_id = project_line_item.project_line_item_id
	ORDER BY project_line_item_image.sort, project_line_item_image.project_line_item_image_id
	LIMIT 1
);
