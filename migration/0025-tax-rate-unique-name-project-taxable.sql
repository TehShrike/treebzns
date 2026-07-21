ALTER TABLE tax_rate
	ADD UNIQUE KEY uq_tax_rate_company_name (company_id, name),
	DROP INDEX idx_tax_rate_company;

ALTER TABLE project
	ADD COLUMN taxable BIT(1) NOT NULL DEFAULT 0 AFTER sent_for_client_approval;
