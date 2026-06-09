-- CREATE DATABASE crm CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;


CREATE TABLE company (
	company_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	name VARCHAR(500) NOT NULL,
	logo BLOB,
	brand_color VARCHAR(20),
	default_initial_project_document_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (company_id)
) ENGINE=InnoDB;


-- Global codebook; no company_id intentionally.
-- code uses utf8mb4_bin so permission codes are matched exactly/case-sensitively.
CREATE TABLE permission (
	permission_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	code VARCHAR(100) NOT NULL COLLATE utf8mb4_bin,
	name VARCHAR(200) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (permission_id),
	UNIQUE KEY uq_permission_code (code)
) ENGINE=InnoDB;


CREATE TABLE tax_rate (
	tax_rate_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	name VARCHAR(200) NOT NULL,
	tax_rate DECIMAL(6,4) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (tax_rate_id),
	INDEX idx_tax_rate_company (company_id)
) ENGINE=InnoDB;


CREATE TABLE project_document (
	project_document_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	group_name VARCHAR(100) NOT NULL DEFAULT '',
	name VARCHAR(200) NOT NULL,
	needs_estimate_to_move_on BIT(1) NOT NULL DEFAULT 0,
	needs_client_approval_to_move_on BIT(1) NOT NULL DEFAULT 0,
	can_expire BIT(1) NOT NULL DEFAULT 0,
	expire_days SMALLINT UNSIGNED,
	next_project_document_id INT UNSIGNED,
	should_be_worked BIT(1) NOT NULL DEFAULT 0,
	needs_to_be_contacted_by_lead_qualifier BIT(1) NOT NULL DEFAULT 0,
	can_be_closed BIT(1) NOT NULL DEFAULT 0,
	represents_billable_sale_when_closed BIT(1) NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_document_id),
	INDEX idx_project_document_company_next (company_id, next_project_document_id)
) ENGINE=InnoDB;


CREATE TABLE item_type (
	item_type_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	name VARCHAR(100) NOT NULL,
	taxable BIT(1) NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (item_type_id),
	INDEX idx_item_type_company (company_id)
) ENGINE=InnoDB;


CREATE TABLE work_skill (
	work_skill_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	name VARCHAR(100) NOT NULL,
	hourly_rate DECIMAL(10,2) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (work_skill_id),
	INDEX idx_work_skill_company (company_id)
) ENGINE=InnoDB;


CREATE TABLE software_role (
	software_role_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	name VARCHAR(100) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (software_role_id),
	INDEX idx_software_role_company (company_id)
) ENGINE=InnoDB;


CREATE TABLE software_role_permission (
	company_id INT UNSIGNED NOT NULL,
	software_role_id INT UNSIGNED NOT NULL,
	permission_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (company_id, software_role_id, permission_id),
	INDEX idx_srp_company_permission (company_id, permission_id)
) ENGINE=InnoDB;


-- client and client_address reference each other (primary/billing address).
-- Both columns are populated after the address rows are inserted.
CREATE TABLE client (
	client_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	name VARCHAR(500) NOT NULL,
	primary_client_address_id INT UNSIGNED NOT NULL,
	billing_client_address_id INT UNSIGNED NOT NULL,
	primary_phone VARCHAR(30),
	primary_email VARCHAR(500),
	tax_rate_id INT UNSIGNED,
	notes TEXT,
	referred_by VARCHAR(500),
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (client_id),
	INDEX idx_client_company_tax_rate (company_id, tax_rate_id)
) ENGINE=InnoDB;


CREATE TABLE client_address (
	client_address_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	client_id INT UNSIGNED NOT NULL,
	name VARCHAR(200) NOT NULL,
	address_line_1 VARCHAR(500) NOT NULL,
	address_line_2 VARCHAR(500),
	city VARCHAR(100) NOT NULL,
	state VARCHAR(50) NOT NULL,
	zip VARCHAR(20) NOT NULL,
	contact VARCHAR(500),
	phone VARCHAR(50),
	email VARCHAR(500),
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (client_address_id),
	INDEX idx_client_address_company_client (company_id, client_id)
) ENGINE=InnoDB;


CREATE TABLE client_contact (
	client_contact_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	client_id INT UNSIGNED NOT NULL,
	contact_name VARCHAR(200) NOT NULL,
	phone VARCHAR(30),
	email VARCHAR(500),
	is_primary BIT(1) NOT NULL DEFAULT 0,
	sort_order SMALLINT NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (client_contact_id),
	INDEX idx_client_contact_company_client (company_id, client_id)
) ENGINE=InnoDB;


CREATE TABLE employee (
	employee_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	name VARCHAR(100) NOT NULL,
	email VARCHAR(500) NOT NULL,
	phone VARCHAR(30),
	password_hash VARCHAR(500) NOT NULL COLLATE utf8mb4_bin,
	avatar_url TEXT,
	is_owner BIT(1) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (employee_id),
	UNIQUE KEY uq_employee_company_email (company_id, email)
) ENGINE=InnoDB;


CREATE TABLE employee_software_role (
	employee_software_role_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	employee_id INT UNSIGNED NOT NULL,
	software_role_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (employee_software_role_id),
	INDEX idx_esr_company_employee (company_id, employee_id),
	INDEX idx_esr_company_software_role (company_id, software_role_id)
) ENGINE=InnoDB;


CREATE TABLE crew (
	crew_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	crew_leader_id INT UNSIGNED NOT NULL,
	color VARCHAR(7) NOT NULL DEFAULT '#000000',
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (crew_id),
	INDEX idx_crew_company_leader (company_id, crew_leader_id)
) ENGINE=InnoDB;


CREATE TABLE crew_member (
	company_id INT UNSIGNED NOT NULL,
	crew_id INT UNSIGNED NOT NULL,
	employee_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (company_id, crew_id, employee_id),
	INDEX idx_crew_member_company_employee (company_id, employee_id)
) ENGINE=InnoDB;


CREATE TABLE project (
	project_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_document_id INT UNSIGNED NOT NULL,
	client_id INT UNSIGNED NOT NULL,
	client_address_id INT UNSIGNED NOT NULL,
	address_line_1 VARCHAR(500) NOT NULL,
	address_line_2 VARCHAR(500),
	city VARCHAR(100) NOT NULL,
	state VARCHAR(50) NOT NULL,
	zip VARCHAR(20) NOT NULL,
	due_date DATE,
	emergency BIT(1) NOT NULL DEFAULT 0,
	assigned_estimator_employee_id INT UNSIGNED,
	details TEXT,
	created_by_employee_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	needs_client_approval BIT(1) NOT NULL,
	sent_for_client_approval BIT(1) NOT NULL,
	tax_rate_id INT UNSIGNED,
	tax_rate DECIMAL(6,4),
	notes_for_crew TEXT,
	notes_for_office TEXT,
	closed BIT(1) NOT NULL DEFAULT 0,
	closed_at DATETIME,
	closed_date DATE,
	PRIMARY KEY (project_id),
	INDEX idx_project_company_client (company_id, client_id),
	INDEX idx_project_company_document (company_id, project_document_id),
	INDEX idx_project_company_closed (company_id, closed, closed_date),
	INDEX idx_project_company_estimator (company_id, assigned_estimator_employee_id)
) ENGINE=InnoDB;


-- One row per company; last_number is incremented atomically when assigning project numbers
CREATE TABLE project_number (
	project_number_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	last_number INT UNSIGNED NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_number_id),
	UNIQUE KEY uq_project_number_company (company_id)
) ENGINE=InnoDB;


CREATE TABLE project_line_item (
	project_line_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_id INT UNSIGNED NOT NULL,
	description TEXT,
	item_type_id INT UNSIGNED,
	estimated_hours INT UNSIGNED NOT NULL,
	taxable BIT(1) NOT NULL DEFAULT 0,
	quantity DECIMAL(10,2) NOT NULL,
	price DECIMAL(10,2) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_line_item_id),
	INDEX idx_pli_company_project (company_id, project_id),
	INDEX idx_pli_company_item_type (company_id, item_type_id)
) ENGINE=InnoDB;


CREATE TABLE project_line_item_image (
	project_line_item_image_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_line_item_id INT UNSIGNED NOT NULL,
	image BLOB NOT NULL,
	description TEXT,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_line_item_image_id),
	INDEX idx_plii_company_line_item (company_id, project_line_item_id)
) ENGINE=InnoDB;


CREATE TABLE project_client_approval (
	project_client_approval_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	customer_signature BLOB,
	verbal_approval BIT(1) NOT NULL,
	added_by_employee_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_client_approval_id),
	INDEX idx_pca_company_employee (company_id, added_by_employee_id)
) ENGINE=InnoDB;


CREATE TABLE project_work_skill (
	project_work_skill_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	project_id INT UNSIGNED NOT NULL,
	work_skill_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (project_work_skill_id),
	INDEX idx_pws_company_project (company_id, project_id),
	INDEX idx_pws_company_work_skill (company_id, work_skill_id)
) ENGINE=InnoDB;


CREATE TABLE payment (
	payment_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	client_id INT UNSIGNED NOT NULL,
	amount DECIMAL(12,2) NOT NULL,
	payment_method VARCHAR(20) NOT NULL,
	status VARCHAR(20) NOT NULL DEFAULT 'completed',
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (payment_id),
	INDEX idx_payment_company_client (company_id, client_id)
) ENGINE=InnoDB;


CREATE TABLE payment_project (
	payment_project_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	payment_id INT UNSIGNED NOT NULL,
	project_id INT UNSIGNED NOT NULL,
	amount DECIMAL(12,2) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (payment_project_id),
	INDEX idx_payment_project_company_payment (company_id, payment_id),
	INDEX idx_payment_project_company_project (company_id, project_id)
) ENGINE=InnoDB;


CREATE TABLE time_entry (
	time_entry_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	employee_id INT UNSIGNED NOT NULL,
	project_id INT UNSIGNED NOT NULL,
	work_date DATE NOT NULL,
	clock_in DATETIME NOT NULL,
	clock_out DATETIME,
	regular_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (time_entry_id),
	INDEX idx_time_entry_company_employee (company_id, employee_id),
	INDEX idx_time_entry_company_project (company_id, project_id),
	INDEX idx_time_entry_company_work_date (company_id, work_date)
) ENGINE=InnoDB;
