ALTER TABLE project_image
	ADD COLUMN strokes JSON DEFAULT NULL AFTER description;
