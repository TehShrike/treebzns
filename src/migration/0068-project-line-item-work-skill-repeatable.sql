ALTER TABLE project_line_item_work_skill
	DROP INDEX uq_pliws_project_line_item_work_skill,
	ADD INDEX idx_pliws_project_line_item (project_line_item_id);
