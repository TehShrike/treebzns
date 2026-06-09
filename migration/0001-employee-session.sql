CREATE TABLE employee_session (
	employee_session_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	employee_id INT UNSIGNED NOT NULL,
	session_identifier VARCHAR(500) NOT NULL COLLATE utf8mb4_bin,
	enabled BIT(1) NOT NULL DEFAULT 1,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (employee_session_id),
	UNIQUE KEY uq_employee_session_identifier (session_identifier),
	INDEX idx_employee_session_employee (employee_id)
) ENGINE=InnoDB;
