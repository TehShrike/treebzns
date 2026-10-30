UPDATE project_image SET uploaded_at = NULL WHERE original_object_key = '' OR thumbnail_object_key = '';

UPDATE project_image SET display_object_key = original_object_key, display_etag = original_etag
WHERE uploaded_at IS NOT NULL AND display_object_key = '';

ALTER TABLE project_image
	MODIFY original_object_key VARCHAR(1024) NULL DEFAULT NULL,
	MODIFY display_object_key VARCHAR(1024) NULL DEFAULT NULL,
	MODIFY thumbnail_object_key VARCHAR(1024) NULL DEFAULT NULL;

UPDATE project_image SET original_object_key = NULL, display_object_key = NULL, thumbnail_object_key = NULL
WHERE uploaded_at IS NULL;

ALTER TABLE project_image ADD CONSTRAINT chk_project_image_uploaded_files CHECK (
	(uploaded_at IS NULL AND original_object_key IS NULL AND display_object_key IS NULL AND thumbnail_object_key IS NULL)
	OR (uploaded_at IS NOT NULL AND original_object_key IS NOT NULL AND display_object_key IS NOT NULL AND thumbnail_object_key IS NOT NULL)
);
