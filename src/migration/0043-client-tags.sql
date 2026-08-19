CREATE TABLE client_tag (
	client_tag_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	name VARCHAR(100) NOT NULL,
	color VARCHAR(20) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (client_tag_id),
	UNIQUE KEY uq_client_tag_company_name (company_id, name)
) ENGINE=InnoDB;


CREATE TABLE client_client_tag (
	client_client_tag_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	client_id INT UNSIGNED NOT NULL,
	client_tag_id INT UNSIGNED NOT NULL,
	created_by_employee_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (client_client_tag_id),
	UNIQUE KEY uq_cct_client_tag (client_id, client_tag_id),
	INDEX idx_cct_tag (client_tag_id)
) ENGINE=InnoDB;
