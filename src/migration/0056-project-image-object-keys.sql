ALTER TABLE project_image
	DROP COLUMN original_image,
	DROP COLUMN display_image,
	DROP COLUMN thumbnail_image,
	ADD COLUMN original_object_key VARCHAR(255) NOT NULL DEFAULT '' AFTER project_id,
	ADD COLUMN display_object_key VARCHAR(255) NOT NULL DEFAULT '' AFTER original_object_key,
	ADD COLUMN thumbnail_object_key VARCHAR(255) NOT NULL DEFAULT '' AFTER display_object_key;
