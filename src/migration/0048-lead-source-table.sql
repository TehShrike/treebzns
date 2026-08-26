CREATE TABLE lead_source (
	lead_source_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	name VARCHAR(200) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (lead_source_id),
	UNIQUE KEY uq_lead_source_company_name (company_id, name)
) ENGINE=InnoDB;


ALTER TABLE project
	ADD COLUMN lead_source_id INT UNSIGNED DEFAULT NULL;

INSERT INTO lead_source (company_id, name)
SELECT DISTINCT company_id, lead_source FROM project WHERE lead_source != '';

UPDATE project
JOIN lead_source ON lead_source.company_id = project.company_id AND lead_source.name = project.lead_source
SET project.lead_source_id = lead_source.lead_source_id;

ALTER TABLE project
	DROP COLUMN lead_source;
