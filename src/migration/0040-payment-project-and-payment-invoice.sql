ALTER TABLE payment
	ADD COLUMN project_id INT UNSIGNED AFTER client_id,
	ADD COLUMN tip DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER amount,
	ADD COLUMN merchant_fee DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER tip,
	ADD COLUMN notes VARCHAR(500) NOT NULL DEFAULT '' AFTER payment_method_id,
	ADD COLUMN recorded_by_employee_id INT UNSIGNED AFTER notes,
	ADD INDEX idx_payment_project (project_id);


CREATE TABLE payment_invoice (
	payment_invoice_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	payment_id INT UNSIGNED NOT NULL,
	invoice_id INT UNSIGNED NOT NULL,
	amount DECIMAL(12,2) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (payment_invoice_id),
	UNIQUE KEY uq_payment_invoice (payment_id, invoice_id),
	INDEX idx_payment_invoice_invoice (invoice_id)
) ENGINE=InnoDB;


DROP TABLE payment_project;
