ALTER TABLE project_image
	ADD COLUMN original_etag VARCHAR(100) NOT NULL DEFAULT '' AFTER original_object_key,
	ADD COLUMN display_etag VARCHAR(100) NOT NULL DEFAULT '' AFTER display_object_key,
	ADD COLUMN thumbnail_etag VARCHAR(100) NOT NULL DEFAULT '' AFTER thumbnail_object_key;
