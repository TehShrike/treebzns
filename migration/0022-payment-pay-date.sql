ALTER TABLE payment
	ADD COLUMN pay_date DATE AFTER amount;

UPDATE payment SET pay_date = DATE(created_at);

ALTER TABLE payment
	MODIFY COLUMN pay_date DATE NOT NULL;
