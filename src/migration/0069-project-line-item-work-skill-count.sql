ALTER TABLE project_line_item_work_skill
	ADD COLUMN `count` SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER work_skill_id,
	DROP INDEX idx_pliws_project_line_item,
	ADD UNIQUE INDEX uq_pliws_project_line_item_work_skill (project_line_item_id, work_skill_id);
