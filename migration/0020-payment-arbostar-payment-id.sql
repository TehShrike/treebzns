DELETE payment_project FROM payment_project
JOIN payment ON payment.payment_id = payment_project.payment_id
WHERE payment.arbostar_invoice_id IS NOT NULL;

DELETE FROM payment WHERE arbostar_invoice_id IS NOT NULL;

ALTER TABLE payment
	DROP KEY uq_payment_company_arbostar_invoice_id,
	DROP COLUMN arbostar_invoice_id,
	ADD COLUMN arbostar_payment_id INT UNSIGNED,
	ADD UNIQUE KEY uq_payment_company_arbostar_payment_id (company_id, arbostar_payment_id);
