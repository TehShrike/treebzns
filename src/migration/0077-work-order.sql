RENAME TABLE
	project_crew TO work_order,
	project_crew_employee TO work_order_employee,
	project_crew_project_line_item TO work_order_project_work_item,
	clock_session_line_item TO clock_session_work_item;

ALTER TABLE work_order
	RENAME COLUMN project_crew_id TO work_order_id,
	RENAME INDEX uq_project_crew_project_crew_work_date TO uq_work_order_project_crew_work_date,
	RENAME INDEX uq_project_crew_crew_work_date_day_order TO uq_work_order_crew_work_date_day_order,
	RENAME INDEX uq_project_crew_company_arbostar_schedule_event_id TO uq_work_order_company_arbostar_schedule_event_id;

ALTER TABLE work_order_employee
	RENAME COLUMN project_crew_employee_id TO work_order_employee_id,
	RENAME COLUMN project_crew_id TO work_order_id,
	RENAME INDEX uq_project_crew_employee_project_crew_employee TO uq_work_order_employee_work_order_employee,
	RENAME INDEX idx_project_crew_employee_employee TO idx_work_order_employee_employee;


ALTER TABLE work_order_project_work_item
	RENAME COLUMN project_crew_project_line_item_id TO work_order_project_work_item_id,
	RENAME COLUMN project_crew_id TO work_order_id,
	ADD COLUMN project_work_item_id INT UNSIGNED DEFAULT NULL AFTER work_order_id;

UPDATE work_order_project_work_item
JOIN project_work_item ON project_work_item.project_line_item_id = work_order_project_work_item.project_line_item_id
SET work_order_project_work_item.project_work_item_id = project_work_item.project_work_item_id;

ALTER TABLE work_order_project_work_item
	DROP INDEX uq_pcpli_project_crew_project_line_item,
	DROP INDEX idx_pcpli_project_line_item,
	DROP COLUMN project_line_item_id,
	MODIFY COLUMN project_work_item_id INT UNSIGNED NOT NULL,
	ADD UNIQUE KEY uq_wopwi_work_order_project_work_item (work_order_id, project_work_item_id),
	ADD INDEX idx_wopwi_project_work_item (project_work_item_id);


ALTER TABLE clock_session_work_item
	RENAME COLUMN clock_session_line_item_id TO clock_session_work_item_id,
	ADD COLUMN project_work_item_id INT UNSIGNED DEFAULT NULL AFTER clock_session_id;

UPDATE clock_session_work_item
JOIN project_work_item ON project_work_item.project_line_item_id = clock_session_work_item.project_line_item_id
SET clock_session_work_item.project_work_item_id = project_work_item.project_work_item_id;

ALTER TABLE clock_session_work_item
	DROP INDEX uq_csli_session_line_item,
	DROP INDEX idx_csli_project_line_item,
	DROP COLUMN project_line_item_id,
	MODIFY COLUMN project_work_item_id INT UNSIGNED NOT NULL,
	ADD UNIQUE KEY uq_cswi_session_work_item (clock_session_id, project_work_item_id),
	ADD INDEX idx_cswi_project_work_item (project_work_item_id);


ALTER TABLE clock_session
	ADD COLUMN work_order_id INT UNSIGNED DEFAULT NULL AFTER company_id;

UPDATE clock_session
JOIN work_order ON work_order.project_id = clock_session.project_id
	AND work_order.crew_id = clock_session.crew_id
	AND work_order.work_date = clock_session.work_date
SET clock_session.work_order_id = work_order.work_order_id;

ALTER TABLE clock_session
	DROP INDEX idx_clock_session_project,
	DROP COLUMN project_id,
	MODIFY COLUMN work_order_id INT UNSIGNED NOT NULL,
	ADD INDEX idx_clock_session_work_order (work_order_id);
