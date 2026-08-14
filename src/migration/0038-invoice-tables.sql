CREATE TABLE invoice (
	invoice_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	invoice_number INT UNSIGNED NOT NULL,
	client_id INT UNSIGNED NOT NULL,
	project_id INT UNSIGNED,
	billing_name VARCHAR(500) NOT NULL,
	billing_address_line_1 VARCHAR(500) NOT NULL,
	billing_address_line_2 VARCHAR(500) NOT NULL,
	billing_city VARCHAR(100) NOT NULL,
	billing_state VARCHAR(50) NOT NULL,
	billing_zip VARCHAR(20) NOT NULL,
	invoice_date DATE NOT NULL,
	due_date DATE NOT NULL,
	taxable BIT(1) NOT NULL,
	tax_rate_id INT UNSIGNED,
	tax_rate DECIMAL(4,4),
	subtotal DECIMAL(10,2) NOT NULL,
	taxable_subtotal DECIMAL(10,2) NOT NULL,
	discount DECIMAL(10,2),
	line_item_discount_subtotal DECIMAL(10,2),
	client_credit_applied DECIMAL(10,2) NOT NULL DEFAULT 0,
	tax_total DECIMAL(10,2) NOT NULL,
	fee DECIMAL(10,2) NOT NULL DEFAULT 0,
	total DECIMAL(10,2) NOT NULL,
	created_by_employee_id INT UNSIGNED,
	arbostar_invoice_id INT UNSIGNED,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (invoice_id),
	UNIQUE KEY uq_invoice_company_number (company_id, invoice_number),
	INDEX idx_invoice_client (client_id),
	INDEX idx_invoice_project (project_id),
	UNIQUE KEY uq_invoice_company_arbostar_invoice_id (company_id, arbostar_invoice_id)
) ENGINE=InnoDB;


CREATE TABLE invoice_number (
	invoice_number_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	next_number INT UNSIGNED NOT NULL DEFAULT 1,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (invoice_number_id),
	UNIQUE KEY uq_invoice_number_company (company_id)
) ENGINE=InnoDB;

INSERT INTO invoice_number (company_id)
SELECT company_id FROM company;


CREATE TABLE client_credit (
	client_credit_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	client_id INT UNSIGNED NOT NULL,
	amount DECIMAL(10,2) NOT NULL,
	notes VARCHAR(500) NOT NULL DEFAULT '',
	created_by_employee_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (client_credit_id),
	INDEX idx_client_credit_client (client_id)
) ENGINE=InnoDB;


CREATE TABLE invoice_line_item (
	invoice_line_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	invoice_id INT UNSIGNED NOT NULL,
	project_line_item_id INT UNSIGNED,
	description VARCHAR(200) NOT NULL,
	quantity DECIMAL(10,2) NOT NULL,
	price DECIMAL(10,2) NOT NULL,
	discount_rate DECIMAL(5,4),
	discount DECIMAL(10,2),
	taxable BIT(1) NOT NULL,
	sort INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (invoice_line_item_id),
	INDEX idx_ili_invoice (invoice_id),
	INDEX idx_ili_project_line_item (project_line_item_id)
) ENGINE=InnoDB;


ALTER TABLE company
	ADD COLUMN invoice_due_after_days INT UNSIGNED NOT NULL DEFAULT 30;
