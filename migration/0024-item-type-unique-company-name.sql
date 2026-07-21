ALTER TABLE item_type
	ADD UNIQUE KEY uq_item_type_company_name (company_id, name),
	DROP INDEX idx_item_type_company;
