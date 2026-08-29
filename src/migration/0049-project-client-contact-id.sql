ALTER TABLE project
	ADD COLUMN client_contact_id int unsigned DEFAULT NULL AFTER client_address_id;


UPDATE project
JOIN client_contact ON client_contact.client_id = project.client_id
	AND client_contact.name = project.contact_name
	AND client_contact.phone = project.contact_phone
	AND client_contact.email = project.contact_email
SET project.client_contact_id = client_contact.client_contact_id
WHERE project.client_contact_id IS NULL;


UPDATE project
JOIN client_contact ON client_contact.client_id = project.client_id
	AND client_contact.is_primary = 1
SET project.client_contact_id = client_contact.client_contact_id
WHERE project.client_contact_id IS NULL;


INSERT INTO client_contact (company_id, client_id, name, phone, email, is_primary, sort)
SELECT project.company_id, project.client_id, project.contact_name, project.contact_phone, project.contact_email, 1, 1
FROM project
JOIN (
	SELECT client_id, MIN(project_id) AS project_id
	FROM project
	WHERE client_contact_id IS NULL
	GROUP BY client_id
) one_project_per_client ON one_project_per_client.project_id = project.project_id;


UPDATE project
JOIN client_contact ON client_contact.client_id = project.client_id
SET project.client_contact_id = client_contact.client_contact_id
WHERE project.client_contact_id IS NULL;


ALTER TABLE project
	MODIFY COLUMN client_contact_id int unsigned NOT NULL,
	DROP COLUMN contact_name,
	DROP COLUMN contact_phone,
	DROP COLUMN contact_email,
	ADD KEY idx_project_contact (client_contact_id);
