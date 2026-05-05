#!/bin/bash
set -euo pipefail

mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" <<'SQL'
SET foreign_key_checks = 0;
DROP TABLE IF EXISTS
	time_entry, payment_project, payment,
	project_work_skill, project_client_approval,
	project_line_item_image, project_line_item, project_number,
	project, crew_member, crew, employee_software_role, employee,
	client_contact, client_address, client,
	software_role_permission, software_role,
	work_skill, item_type, project_document, tax_rate, permission, company;
SET foreign_key_checks = 1;
SQL

mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" < migration/0000-initial.sql

echo "Done"
