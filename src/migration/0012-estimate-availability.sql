CREATE TABLE estimate_availability (
	estimate_availability_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_id INT UNSIGNED NOT NULL,
	availability_date DATE NOT NULL,
	start_time TIME NOT NULL,
	end_time TIME NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (estimate_availability_id),
	INDEX idx_estimate_availability_company_project (company_id, project_id)
) ENGINE=InnoDB;
