ALTER TABLE project_crew
	ADD COLUMN arbostar_schedule_event_id BIGINT UNSIGNED,
	ADD UNIQUE KEY uq_project_crew_company_arbostar_schedule_event_id (company_id, arbostar_schedule_event_id);
