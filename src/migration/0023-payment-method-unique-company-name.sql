ALTER TABLE payment_method
	ADD UNIQUE KEY uq_payment_method_company_name (company_id, name),
	DROP INDEX idx_payment_method_company;
