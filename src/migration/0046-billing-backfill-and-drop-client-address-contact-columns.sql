UPDATE client
JOIN client_address ON client_address.client_address_id = client.default_project_address_id
SET client.billing_name = client.name,
	client.billing_address_line_1 = client_address.address_line_1,
	client.billing_address_line_2 = client_address.address_line_2,
	client.billing_city = client_address.city,
	client.billing_state = client_address.state,
	client.billing_zip = client_address.zip
WHERE client.billing_name = ''
	AND client.billing_address_line_1 = ''
	AND client.billing_address_line_2 = ''
	AND client.billing_city = ''
	AND client.billing_state = ''
	AND client.billing_zip = '';


ALTER TABLE client_address
	DROP COLUMN contact,
	DROP COLUMN phone,
	DROP COLUMN email;
