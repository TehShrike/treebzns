CREATE TABLE project_work_item (
	project_work_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_line_item_id INT UNSIGNED NOT NULL,
	work_type_id INT UNSIGNED DEFAULT NULL,
	work_details TEXT NOT NULL DEFAULT (''),
	estimated_crew_size TINYINT UNSIGNED DEFAULT NULL,
	estimated_hours DECIMAL(10,2) DEFAULT NULL,
	hourly_rate DECIMAL(10,2) DEFAULT NULL,
	price DECIMAL(10,2) NOT NULL,
	discount DECIMAL(10,2) DEFAULT NULL,
	sort SMALLINT UNSIGNED NOT NULL,
	done_at DATETIME DEFAULT NULL,
	done_by_employee_id INT UNSIGNED DEFAULT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_work_item_id),
	INDEX idx_pwi_project_line_item (project_line_item_id),
	INDEX idx_pwi_work_type (work_type_id)
) ENGINE=InnoDB;


CREATE TABLE project_work_item_equipment (
	project_work_item_equipment_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_work_item_id INT UNSIGNED NOT NULL,
	equipment_id INT UNSIGNED NOT NULL,
	count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_work_item_equipment_id),
	UNIQUE KEY uq_pwie_project_work_item_equipment (project_work_item_id, equipment_id),
	INDEX idx_pwie_equipment (equipment_id)
) ENGINE=InnoDB;


INSERT INTO project_work_item (
	company_id,
	project_line_item_id,
	work_type_id,
	estimated_crew_size,
	estimated_hours,
	price,
	discount,
	sort,
	done_at,
	done_by_employee_id,
	created_at,
	updated_at
)
SELECT
	company_id,
	project_line_item_id,
	item_type_id,
	estimated_crew_size,
	estimated_hours,
	ROUND(quantity * price, 2),
	IF(discount_rate IS NOT NULL, ROUND(discount_rate * ROUND(quantity * price, 2), 2), discount),
	0,
	done_at,
	done_by_employee_id,
	created_at,
	updated_at
FROM project_line_item;


UPDATE project_line_item
SET price = ROUND(quantity * price, 2),
	work_details = COALESCE(work_details, '');

ALTER TABLE project_line_item
	DROP INDEX idx_pli_item_type,
	DROP INDEX idx_pli_line_item_template,
	DROP COLUMN item_type_id,
	DROP COLUMN line_item_template_id,
	DROP COLUMN estimated_crew_size,
	DROP COLUMN estimated_hours,
	DROP COLUMN quantity,
	DROP COLUMN discount,
	DROP COLUMN done_at,
	DROP COLUMN done_by_employee_id,
	CHANGE COLUMN work_details description TEXT NOT NULL DEFAULT ('');
