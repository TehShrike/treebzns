ALTER TABLE project_image
	ADD COLUMN thumbnail_image MEDIUMBLOB NULL AFTER display_image,
	ADD COLUMN uploaded_at DATETIME NULL AFTER visible_to_client;
