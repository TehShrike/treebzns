RENAME TABLE item_type TO work_type;

ALTER TABLE work_type
	RENAME COLUMN item_type_id TO work_type_id,
	RENAME INDEX uq_item_type_company_name TO uq_work_type_company_name,
	ADD COLUMN hourly_rate DECIMAL(10,2) DEFAULT NULL AFTER taxable;


CREATE TABLE equipment (
	equipment_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	name VARCHAR(200) NOT NULL,
	short_name VARCHAR(50) NOT NULL DEFAULT '',
	hourly_rate DECIMAL(10,2) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (equipment_id),
	UNIQUE KEY uq_equipment_company_name (company_id, name)
) ENGINE=InnoDB;
