ALTER TABLE crew
	DROP INDEX idx_crew_company_leader,
	DROP COLUMN crew_leader_id,
	ADD COLUMN name VARCHAR(100) NOT NULL AFTER company_id,
	ADD INDEX idx_crew_company (company_id);

RENAME TABLE crew_member TO crew_regular;

ALTER TABLE crew_regular
	RENAME INDEX idx_crew_member_company_employee TO idx_crew_regular_company_employee;

CREATE TABLE crew_regular_history (
	crew_regular_history_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	crew_id INT UNSIGNED NOT NULL,
	employee_id INT UNSIGNED NOT NULL,
	action VARCHAR(20) NOT NULL,
	changed_by_employee_id INT UNSIGNED,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (crew_regular_history_id),
	INDEX idx_crew_regular_history_company_crew (company_id, crew_id),
	INDEX idx_crew_regular_history_company_employee (company_id, employee_id)
) ENGINE=InnoDB;


CREATE TABLE project_crew (
	project_crew_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_id INT UNSIGNED NOT NULL,
	crew_id INT UNSIGNED NOT NULL,
	work_date DATE NOT NULL,
	day_order TINYINT UNSIGNED,
	start_time TIME,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_crew_id),
	UNIQUE KEY uq_project_crew_project_crew_work_date (project_id, crew_id, work_date),
	UNIQUE KEY uq_project_crew_crew_work_date_day_order (crew_id, work_date, day_order),
	INDEX idx_project_crew_company_project (company_id, project_id),
	INDEX idx_project_crew_company_crew_work_date (company_id, crew_id, work_date)
) ENGINE=InnoDB;


CREATE TABLE project_crew_employee (
	project_crew_employee_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_crew_id INT UNSIGNED NOT NULL,
	employee_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_crew_employee_id),
	UNIQUE KEY uq_project_crew_employee_project_crew_employee (project_crew_id, employee_id),
	INDEX idx_project_crew_employee_company_employee (company_id, employee_id)
) ENGINE=InnoDB;


CREATE TABLE project_crew_project_line_item (
	project_crew_project_line_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_crew_id INT UNSIGNED NOT NULL,
	project_line_item_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_crew_project_line_item_id),
	UNIQUE KEY uq_pcpli_project_crew_project_line_item (project_crew_id, project_line_item_id),
	INDEX idx_pcpli_company_project_line_item (company_id, project_line_item_id)
) ENGINE=InnoDB;


ALTER TABLE company
	ADD COLUMN default_crew_start_time TIME NOT NULL DEFAULT '08:00:00';


CREATE TABLE employee_work_skill (
	employee_work_skill_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	employee_id INT UNSIGNED NOT NULL,
	work_skill_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (employee_work_skill_id),
	UNIQUE KEY uq_employee_work_skill_employee_work_skill (employee_id, work_skill_id),
	INDEX idx_employee_work_skill_company_work_skill (company_id, work_skill_id)
) ENGINE=InnoDB;


CREATE TABLE project_line_item_work_skill (
	project_line_item_work_skill_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_line_item_id INT UNSIGNED NOT NULL,
	work_skill_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_line_item_work_skill_id),
	UNIQUE KEY uq_pliws_project_line_item_work_skill (project_line_item_id, work_skill_id),
	INDEX idx_pliws_company_work_skill (company_id, work_skill_id)
) ENGINE=InnoDB;


DROP TABLE project_work_skill;


CREATE TABLE line_item_template (
	line_item_template_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	title VARCHAR(200) NOT NULL,
	arbostar_work_type_id INT UNSIGNED,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (line_item_template_id),
	UNIQUE KEY uq_line_item_template_company_title (company_id, title),
	UNIQUE KEY uq_line_item_template_company_arbostar_work_type_id (company_id, arbostar_work_type_id)
) ENGINE=InnoDB;


CREATE TABLE line_item_template_work_skill (
	line_item_template_work_skill_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	line_item_template_id INT UNSIGNED NOT NULL,
	work_skill_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (line_item_template_work_skill_id),
	UNIQUE KEY uq_litws_line_item_template_work_skill (line_item_template_id, work_skill_id),
	INDEX idx_litws_company_work_skill (company_id, work_skill_id)
) ENGINE=InnoDB;


ALTER TABLE project_line_item
	ADD COLUMN title VARCHAR(200) NOT NULL DEFAULT '' AFTER project_id,
	RENAME COLUMN description TO work_details,
	ADD COLUMN line_item_template_id INT UNSIGNED AFTER item_type_id,
	ADD INDEX idx_pli_company_line_item_template (company_id, line_item_template_id);


CREATE TABLE project_image (
	project_image_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_id INT UNSIGNED NOT NULL,
	original_image MEDIUMBLOB NOT NULL,
	display_image MEDIUMBLOB,
	description TEXT NOT NULL,
	visible_to_client BIT(1) NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	source_project_line_item_image_id INT UNSIGNED,
	PRIMARY KEY (project_image_id),
	INDEX idx_project_image_company_project (company_id, project_id)
) ENGINE=InnoDB;

ALTER TABLE project_line_item_image
	ADD COLUMN project_image_id INT UNSIGNED AFTER company_id;

INSERT INTO project_image (company_id, project_id, original_image, description, source_project_line_item_image_id)
SELECT
	project_line_item_image.company_id,
	project_line_item.project_id,
	project_line_item_image.image,
	COALESCE(project_line_item_image.description, ''),
	project_line_item_image.project_line_item_image_id
FROM project_line_item_image
JOIN project_line_item ON project_line_item.project_line_item_id = project_line_item_image.project_line_item_id;

UPDATE project_line_item_image
JOIN project_image ON project_image.source_project_line_item_image_id = project_line_item_image.project_line_item_image_id
SET project_line_item_image.project_image_id = project_image.project_image_id;

DELETE FROM project_line_item_image WHERE project_image_id IS NULL;

ALTER TABLE project_image
	DROP COLUMN source_project_line_item_image_id;

ALTER TABLE project_line_item_image
	MODIFY COLUMN project_image_id INT UNSIGNED NOT NULL,
	DROP COLUMN image,
	DROP COLUMN description,
	ADD UNIQUE KEY uq_plii_project_image_project_line_item (project_image_id, project_line_item_id);


DELETE FROM project_client_approval;

ALTER TABLE project_client_approval
	ADD COLUMN project_id INT UNSIGNED NOT NULL AFTER company_id,
	ADD INDEX idx_pca_company_project (company_id, project_id);


CREATE TABLE project_document_history (
	project_document_history_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_id INT UNSIGNED NOT NULL,
	project_document_id INT UNSIGNED NOT NULL,
	changed_by_employee_id INT UNSIGNED,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_document_history_id),
	INDEX idx_pdh_company_project (company_id, project_id),
	INDEX idx_pdh_company_project_document (company_id, project_document_id)
) ENGINE=InnoDB;

INSERT INTO project_document_history (company_id, project_id, project_document_id, created_at)
SELECT company_id, project_id, project_document_id, created_at
FROM project;


ALTER TABLE project
	ADD COLUMN contact_name VARCHAR(500) NOT NULL DEFAULT '',
	ADD COLUMN contact_phone VARCHAR(30) NOT NULL DEFAULT '',
	ADD COLUMN contact_email VARCHAR(500) NOT NULL DEFAULT '',
	ADD COLUMN latitude DOUBLE,
	ADD COLUMN longitude DOUBLE;

ALTER TABLE client_address
	ADD COLUMN latitude DOUBLE,
	ADD COLUMN longitude DOUBLE;
