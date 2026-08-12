-- A tax rate is a ratio and can never reach 1, so DECIMAL(4,4) (max 0.9999) is enough.

ALTER TABLE tax_rate
	MODIFY tax_rate DECIMAL(4,4) NOT NULL;

ALTER TABLE project
	MODIFY tax_rate DECIMAL(4,4);
