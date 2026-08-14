ALTER TABLE project
	ADD COLUMN taxable_subtotal DECIMAL(10,2) AFTER subtotal,
	ADD COLUMN discount DECIMAL(10,2) AFTER taxable_subtotal,
	ADD COLUMN line_item_discount_subtotal DECIMAL(10,2) AFTER discount;

ALTER TABLE project_line_item
	ADD COLUMN discount_rate DECIMAL(5,4) AFTER price,
	ADD COLUMN discount DECIMAL(10,2) AFTER discount_rate,
	ADD COLUMN sort INT UNSIGNED AFTER discount;

UPDATE project_line_item
JOIN (
	SELECT project_line_item_id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY project_line_item_id) AS n
	FROM project_line_item
) numbered ON numbered.project_line_item_id = project_line_item.project_line_item_id
SET project_line_item.sort = numbered.n;

ALTER TABLE project_line_item
	MODIFY COLUMN sort INT UNSIGNED NOT NULL;
