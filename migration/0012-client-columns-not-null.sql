UPDATE client SET primary_phone = '' WHERE primary_phone IS NULL;
UPDATE client SET primary_email = '' WHERE primary_email IS NULL;
UPDATE client SET notes = '' WHERE notes IS NULL;
UPDATE client SET referred_by = '' WHERE referred_by IS NULL;

ALTER TABLE client
	MODIFY COLUMN primary_phone VARCHAR(30) NOT NULL DEFAULT '',
	MODIFY COLUMN primary_email VARCHAR(500) NOT NULL DEFAULT '',
	MODIFY COLUMN notes TEXT NOT NULL DEFAULT (''),
	MODIFY COLUMN referred_by VARCHAR(500) NOT NULL DEFAULT '';
