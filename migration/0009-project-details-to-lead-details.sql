-- 0009-project-details-to-lead-details.sql

ALTER TABLE project
	CHANGE COLUMN details lead_details TEXT;
