ALTER TABLE company
	ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'America/Chicago';

ALTER TABLE company
	ALTER COLUMN timezone DROP DEFAULT;


CREATE TABLE clock_session (
	clock_session_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_id INT UNSIGNED NOT NULL,
	crew_id INT UNSIGNED,
	work_date DATE NOT NULL,
	supersedes_clock_session_id INT UNSIGNED,
	notes VARCHAR(500) NOT NULL DEFAULT '',
	opened_by_employee_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (clock_session_id),
	UNIQUE KEY uq_clock_session_supersedes (supersedes_clock_session_id),
	INDEX idx_clock_session_company_work_date (company_id, work_date),
	INDEX idx_clock_session_project (project_id),
	INDEX idx_clock_session_crew (crew_id)
) ENGINE=InnoDB;


CREATE TABLE clock_session_line_item (
	clock_session_line_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	clock_session_id INT UNSIGNED NOT NULL,
	project_line_item_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (clock_session_line_item_id),
	UNIQUE KEY uq_csli_session_line_item (clock_session_id, project_line_item_id),
	INDEX idx_csli_project_line_item (project_line_item_id)
) ENGINE=InnoDB;


CREATE TABLE clock_session_employee (
	clock_session_employee_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	clock_session_id INT UNSIGNED NOT NULL,
	employee_id INT UNSIGNED NOT NULL,
	clock_in DATETIME NOT NULL,
	clock_in_day DATE NOT NULL,
	clock_out DATETIME,
	clocked_in_by_employee_id INT UNSIGNED NOT NULL,
	clocked_out_by_employee_id INT UNSIGNED,
	open_employee_id INT UNSIGNED GENERATED ALWAYS AS (IF(clock_out IS NULL, employee_id, NULL)) VIRTUAL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (clock_session_employee_id),
	UNIQUE KEY uq_cse_open_employee (open_employee_id),
	INDEX idx_cse_session (clock_session_id),
	INDEX idx_cse_employee_clock_in_day (employee_id, clock_in_day)
) ENGINE=InnoDB;


CREATE TABLE clock_session_employee_history (
	clock_session_employee_history_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	clock_session_employee_id INT UNSIGNED NOT NULL,
	previous_clock_in DATETIME,
	previous_clock_out DATETIME,
	new_clock_in DATETIME,
	new_clock_out DATETIME,
	changed_by_employee_id INT UNSIGNED,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (clock_session_employee_history_id),
	INDEX idx_cseh_clock_session_employee (clock_session_employee_id)
) ENGINE=InnoDB;


DROP TABLE time_entry;
