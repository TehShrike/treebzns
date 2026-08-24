ALTER TABLE client_address
	ADD COLUMN sort SMALLINT UNSIGNED AFTER zip;

UPDATE client_address
JOIN (
	SELECT client_address_id, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY client_address_id) - 1 AS n
	FROM client_address
) numbered ON numbered.client_address_id = client_address.client_address_id
SET client_address.sort = numbered.n;

ALTER TABLE client_address
	MODIFY COLUMN sort SMALLINT UNSIGNED NOT NULL;
