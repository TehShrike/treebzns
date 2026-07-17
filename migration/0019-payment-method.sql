CREATE TABLE payment_method (
	payment_method_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	name VARCHAR(100) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (payment_method_id),
	INDEX idx_payment_method_company (company_id)
) ENGINE=InnoDB;

INSERT INTO payment_method (company_id, name)
SELECT company.company_id, defaults.name
FROM company
CROSS JOIN (
	SELECT 'Cash' AS name
	UNION ALL SELECT 'Credit Card'
	UNION ALL SELECT 'Check'
) defaults;

INSERT INTO payment_method (company_id, name)
SELECT DISTINCT payment.company_id, payment.payment_method
FROM payment
LEFT JOIN payment_method
	ON payment_method.company_id = payment.company_id
	AND payment_method.name = payment.payment_method
WHERE payment_method.payment_method_id IS NULL;

ALTER TABLE payment
	ADD COLUMN payment_method_id INT UNSIGNED AFTER amount;

UPDATE payment
JOIN payment_method
	ON payment_method.company_id = payment.company_id
	AND payment_method.name = payment.payment_method
SET payment.payment_method_id = payment_method.payment_method_id;

ALTER TABLE payment
	MODIFY COLUMN payment_method_id INT UNSIGNED NOT NULL,
	DROP COLUMN payment_method,
	DROP COLUMN status;
