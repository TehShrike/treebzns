# Arborist CRM — SQL Schema

---

## client

- id BIGINT NOT NULL
- name VARCHAR(500) NOT NULL
- referral_source_id BIGINT REFERENCES referral_source(id)
- address_line_1 VARCHAR(255)
- address_line_2 VARCHAR(255)
- city VARCHAR(100)
- state VARCHAR(50)
- zip VARCHAR(20)
- country VARCHAR(50)
- primary_phone VARCHAR(30)
- primary_email VARCHAR(255)
- client_rating SMALLINT
- tax_rate DECIMAL(5,2)
- tax_exempt BOOLEAN NOT NULL DEFAULT FALSE
- billing_info_encrypted TEXT
- wisetack_prequalification_status VARCHAR(30)
- notes TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

## referral_source

- id BIGINT NOT NULL
- name VARCHAR(100) NOT NULL

## client_contact

- id BIGINT NOT NULL
- client_id BIGINT NOT NULL REFERENCES client(id)
- contact_name VARCHAR(200) NOT NULL
- phone VARCHAR(30)
- email VARCHAR(255)
- is_primary BOOLEAN NOT NULL DEFAULT FALSE
- sort_order SMALLINT NOT NULL DEFAULT 0

## client_tag

- client_id BIGINT NOT NULL REFERENCES client(id)
- tag_id BIGINT NOT NULL REFERENCES tag(id)

## tag

- id BIGINT NOT NULL
- name VARCHAR(100) NOT NULL

## client_file

- id BIGINT NOT NULL
- client_id BIGINT NOT NULL REFERENCES client(id)
- file_url TEXT NOT NULL
- file_name VARCHAR(255)
- file_type VARCHAR(50)
- description TEXT
- uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()

## client_photo

- id BIGINT NOT NULL
- client_id BIGINT NOT NULL REFERENCES client(id)
- photo_url TEXT NOT NULL
- latitude DECIMAL(10,7)
- longitude DECIMAL(10,7)
- caption TEXT
- taken_at TIMESTAMPTZ
- uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## lead

- id BIGINT NOT NULL
- client_id BIGINT NOT NULL REFERENCES client(id)
- address_line_1 VARCHAR(255)
- address_line_2 VARCHAR(255)
- city VARCHAR(100)
- state VARCHAR(50)
- zip VARCHAR(20)
- latitude DECIMAL(10,7)
- longitude DECIMAL(10,7)
- project_address_name VARCHAR(255)
- priority VARCHAR(20) NOT NULL DEFAULT 'regular' — regular | priority | emergency
- urgency VARCHAR(20) NOT NULL DEFAULT 'no_rush' — right_away | few_weeks | no_rush
- size VARCHAR(10) NOT NULL DEFAULT 'medium' — small | medium | big
- status VARCHAR(30) NOT NULL DEFAULT 'new' — new | declined | estimated | (custom)
- lead_source_id BIGINT REFERENCES lead_source(id)
- assigned_estimator_id BIGINT REFERENCES employee(id)
- call_client BOOLEAN NOT NULL DEFAULT FALSE
- referral_source_id BIGINT REFERENCES referral_source(id)
- details TEXT
- created_by BIGINT REFERENCES employee(id)
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

## lead_source

- id BIGINT NOT NULL
- name VARCHAR(100) NOT NULL

## lead_service

- lead_id BIGINT NOT NULL REFERENCES lead(id)
- service_id BIGINT NOT NULL REFERENCES service(id)

## lead_product

- lead_id BIGINT NOT NULL REFERENCES lead(id)
- product_id BIGINT NOT NULL REFERENCES product(id)

## lead_bundle

- lead_id BIGINT NOT NULL REFERENCES lead(id)
- bundle_id BIGINT NOT NULL REFERENCES bundle(id)

## lead_file

- id BIGINT NOT NULL
- lead_id BIGINT NOT NULL REFERENCES lead(id)
- file_url TEXT NOT NULL
- file_name VARCHAR(255)
- uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## estimate

- id BIGINT NOT NULL
- estimate_number VARCHAR(50) NOT NULL
- client_id BIGINT NOT NULL REFERENCES client(id)
- lead_id BIGINT REFERENCES lead(id)
- estimator_id BIGINT NOT NULL REFERENCES employee(id)
- status VARCHAR(30) NOT NULL DEFAULT 'new' — new | sent_for_approval | pending | confirmed | declined | expired
- discount_name VARCHAR(100)
- discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0
- tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0
- total_price DECIMAL(12,2) NOT NULL DEFAULT 0
- confirmation_type VARCHAR(20) — deposit | signature | both
- deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0
- customer_comment TEXT
- customer_signature_url TEXT
- revision_date TIMESTAMPTZ
- pdf_url TEXT
- portal_link_token VARCHAR(255)
- wisetack_eligible BOOLEAN NOT NULL DEFAULT FALSE
- notes_crew TEXT
- notes_office TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

## estimate_line_item

- id BIGINT NOT NULL
- estimate_id BIGINT NOT NULL REFERENCES estimate(id)
- item_type VARCHAR(10) NOT NULL — service | product | bundle
- service_id BIGINT REFERENCES service(id)
- product_id BIGINT REFERENCES product(id)
- bundle_id BIGINT REFERENCES bundle(id)
- description TEXT
- classification VARCHAR(15) NOT NULL DEFAULT 'mandatory' — mandatory | recommended | optional
- price DECIMAL(12,2) NOT NULL
- non_taxable BOOLEAN NOT NULL DEFAULT FALSE
- crew_id BIGINT REFERENCES crew(id)
- suggested_date DATE
- sort_order SMALLINT NOT NULL DEFAULT 0
- client_confirmation_status VARCHAR(15) — confirmed | declined
- estimated_hours DECIMAL(6,2)
- mhr_rate DECIMAL(10,2)
- markup_pct DECIMAL(5,2)
- overhead_pct DECIMAL(5,2)

## estimate_line_item_equipment

- estimate_line_item_id BIGINT NOT NULL REFERENCES estimate_line_item(id)
- equipment_type_id BIGINT NOT NULL REFERENCES equipment_type(id)

## estimate_line_item_photo

- id BIGINT NOT NULL
- estimate_line_item_id BIGINT NOT NULL REFERENCES estimate_line_item(id)
- photo_url TEXT NOT NULL
- latitude DECIMAL(10,7)
- longitude DECIMAL(10,7)
- uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()

## project_scheme

- id BIGINT NOT NULL
- estimate_id BIGINT REFERENCES estimate(id)
- work_order_id BIGINT REFERENCES work_order(id)
- satellite_image_url TEXT
- pin_latitude DECIMAL(10,7)
- pin_longitude DECIMAL(10,7)
- annotations_json JSONB — icons, drawings, arrows, circles, labels
- screen_capture_url TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## work_order

- id BIGINT NOT NULL
- estimate_id BIGINT NOT NULL REFERENCES estimate(id)
- client_id BIGINT NOT NULL REFERENCES client(id)
- status_id BIGINT NOT NULL REFERENCES work_order_status(id)
- priority VARCHAR(20) NOT NULL DEFAULT 'regular'
- size VARCHAR(10) NOT NULL DEFAULT 'medium'
- due_date DATE
- scheduled_start TIMESTAMPTZ
- scheduled_end TIMESTAMPTZ
- actual_start TIMESTAMPTZ
- actual_end TIMESTAMPTZ
- crew_id BIGINT REFERENCES crew(id)
- address_line_1 VARCHAR(255)
- address_line_2 VARCHAR(255)
- city VARCHAR(100)
- state VARCHAR(50)
- zip VARCHAR(20)
- latitude DECIMAL(10,7)
- longitude DECIMAL(10,7)
- notes_crew TEXT
- notes_office TEXT
- customer_comment TEXT
- safety_form_completed BOOLEAN NOT NULL DEFAULT FALSE
- is_insurance_job BOOLEAN NOT NULL DEFAULT FALSE
- insurance_claim_number VARCHAR(100)
- total_cost DECIMAL(12,2)
- total_revenue DECIMAL(12,2)
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

## work_order_status

- id BIGINT NOT NULL
- name VARCHAR(50) NOT NULL
- sort_order SMALLINT NOT NULL DEFAULT 0
- is_terminal BOOLEAN NOT NULL DEFAULT FALSE

## work_order_equipment

- work_order_id BIGINT NOT NULL REFERENCES work_order(id)
- equipment_id BIGINT NOT NULL REFERENCES equipment(id)

## work_order_vehicle

- work_order_id BIGINT NOT NULL REFERENCES work_order(id)
- vehicle_id BIGINT NOT NULL REFERENCES vehicle(id)

## work_order_tag

- work_order_id BIGINT NOT NULL REFERENCES work_order(id)
- tag_id BIGINT NOT NULL REFERENCES tag(id)

## work_order_photo

- id BIGINT NOT NULL
- work_order_id BIGINT NOT NULL REFERENCES work_order(id)
- photo_url TEXT NOT NULL
- latitude DECIMAL(10,7)
- longitude DECIMAL(10,7)
- caption TEXT
- taken_at TIMESTAMPTZ
- uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## invoice

- id BIGINT NOT NULL
- invoice_number VARCHAR(50) NOT NULL
- work_order_id BIGINT NOT NULL REFERENCES work_order(id)
- client_id BIGINT NOT NULL REFERENCES client(id)
- subtotal DECIMAL(12,2) NOT NULL
- tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0
- discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0
- total DECIMAL(12,2) NOT NULL
- status VARCHAR(20) NOT NULL DEFAULT 'issued' — issued | sent | paid | overdue | holdback
- due_date DATE NOT NULL
- late_fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0
- pdf_url TEXT
- portal_link_token VARCHAR(255)
- auto_reminder_days SMALLINT
- mailing_status VARCHAR(20) — sent | opened | clicked
- customer_review_text TEXT
- customer_review_sentiment VARCHAR(10) — like | dislike
- customer_tip_amount DECIMAL(12,2) NOT NULL DEFAULT 0
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

## invoice_line_item

- id BIGINT NOT NULL
- invoice_id BIGINT NOT NULL REFERENCES invoice(id)
- description TEXT NOT NULL
- item_type VARCHAR(10) — service | product | bundle
- service_id BIGINT REFERENCES service(id)
- product_id BIGINT REFERENCES product(id)
- bundle_id BIGINT REFERENCES bundle(id)
- quantity DECIMAL(8,2) NOT NULL DEFAULT 1
- unit_price DECIMAL(12,2) NOT NULL
- non_taxable BOOLEAN NOT NULL DEFAULT FALSE
- sort_order SMALLINT NOT NULL DEFAULT 0

## credit_note

- id BIGINT NOT NULL
- invoice_id BIGINT NOT NULL REFERENCES invoice(id)
- amount DECIMAL(12,2) NOT NULL
- reason TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## payment

- id BIGINT NOT NULL
- invoice_id BIGINT NOT NULL REFERENCES invoice(id)
- amount DECIMAL(12,2) NOT NULL
- tip_amount DECIMAL(12,2) NOT NULL DEFAULT 0
- payment_method VARCHAR(20) NOT NULL — cash | check | credit_card
- payment_provider VARCHAR(30) — authorize_net | cardpointe | xero | wisetack
- transaction_id VARCHAR(255)
- is_deposit BOOLEAN NOT NULL DEFAULT FALSE
- status VARCHAR(20) NOT NULL DEFAULT 'completed'
- transacted_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## document_template

- id BIGINT NOT NULL
- name VARCHAR(100) NOT NULL
- template_type VARCHAR(30) NOT NULL — estimate | invoice | work_order | proposal
- body_html TEXT

---

## employee

- id BIGINT NOT NULL
- first_name VARCHAR(100) NOT NULL
- last_name VARCHAR(100) NOT NULL
- email VARCHAR(255) NOT NULL
- phone VARCHAR(30)
- home_address_line_1 VARCHAR(255)
- home_city VARCHAR(100)
- home_state VARCHAR(50)
- home_zip VARCHAR(20)
- home_latitude DECIMAL(10,7)
- home_longitude DECIMAL(10,7)
- company_login_id VARCHAR(50)
- password_hash VARCHAR(255) NOT NULL
- role_id BIGINT NOT NULL REFERENCES role(id)
- avatar_url TEXT
- hourly_rate DECIMAL(10,2)
- ot_hourly_rate DECIMAL(10,2)
- prevailing_wage_rate DECIMAL(10,2)
- pw_ot_rate DECIMAL(10,2)
- is_online BOOLEAN NOT NULL DEFAULT FALSE
- current_latitude DECIMAL(10,7)
- current_longitude DECIMAL(10,7)
- show_in_contact_list BOOLEAN NOT NULL DEFAULT TRUE
- last_login_at TIMESTAMPTZ
- pto_sick_days DECIMAL(5,1) NOT NULL DEFAULT 0
- pto_vacation_days DECIMAL(5,1) NOT NULL DEFAULT 0
- pto_holidays DECIMAL(5,1) NOT NULL DEFAULT 0
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

## role

- id BIGINT NOT NULL
- name VARCHAR(50) NOT NULL — admin | manager | estimator | crew_leader | fieldworker | driver | office_staff | sales_rep | client_service_manager

## permission

- id BIGINT NOT NULL
- module VARCHAR(50) NOT NULL
- action VARCHAR(50) NOT NULL

## role_permission

- role_id BIGINT NOT NULL REFERENCES role(id)
- permission_id BIGINT NOT NULL REFERENCES permission(id)

## employee_certification

- id BIGINT NOT NULL
- employee_id BIGINT NOT NULL REFERENCES employee(id)
- certification_name VARCHAR(150) NOT NULL
- issued_date DATE
- expiry_date DATE
- document_url TEXT

---

## crew

- id BIGINT NOT NULL
- crew_type_id BIGINT REFERENCES crew_type(id)
- crew_leader_id BIGINT NOT NULL REFERENCES employee(id)
- color VARCHAR(7) — hex code
- operation_date DATE NOT NULL
- team_note TEXT
- hidden_team_note TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## crew_type

- id BIGINT NOT NULL
- name VARCHAR(50) NOT NULL

## crew_member

- crew_id BIGINT NOT NULL REFERENCES crew(id)
- employee_id BIGINT NOT NULL REFERENCES employee(id)

## crew_equipment

- crew_id BIGINT NOT NULL REFERENCES crew(id)
- equipment_id BIGINT NOT NULL REFERENCES equipment(id)

## crew_vehicle

- crew_id BIGINT NOT NULL REFERENCES crew(id)
- vehicle_id BIGINT NOT NULL REFERENCES vehicle(id)

---

## schedule

- id BIGINT NOT NULL
- schedule_type VARCHAR(20) NOT NULL — crew | office
- date DATE NOT NULL
- view_mode VARCHAR(15) NOT NULL DEFAULT 'day' — day | week | month | timeline | custom
- route_optimized BOOLEAN NOT NULL DEFAULT FALSE

## schedule_event

- id BIGINT NOT NULL
- schedule_id BIGINT NOT NULL REFERENCES schedule(id)
- work_order_id BIGINT REFERENCES work_order(id)
- task_id BIGINT REFERENCES task(id)
- crew_id BIGINT REFERENCES crew(id)
- employee_id BIGINT REFERENCES employee(id)
- start_at TIMESTAMPTZ NOT NULL
- end_at TIMESTAMPTZ NOT NULL
- notes TEXT

---

## time_entry

- id BIGINT NOT NULL
- employee_id BIGINT NOT NULL REFERENCES employee(id)
- work_date DATE NOT NULL
- clock_in TIMESTAMPTZ NOT NULL
- clock_out TIMESTAMPTZ
- regular_hours DECIMAL(5,2) NOT NULL DEFAULT 0
- ot_hours DECIMAL(5,2) NOT NULL DEFAULT 0
- pw_hours DECIMAL(5,2) NOT NULL DEFAULT 0
- pw_ot_hours DECIMAL(5,2) NOT NULL DEFAULT 0
- expenses DECIMAL(10,2) NOT NULL DEFAULT 0
- deductions DECIMAL(10,2) NOT NULL DEFAULT 0
- total_hours DECIMAL(5,2) GENERATED ALWAYS AS (regular_hours + ot_hours + pw_hours + pw_ot_hours)
- total_pay DECIMAL(10,2)
- manually_adjusted BOOLEAN NOT NULL DEFAULT FALSE
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## payroll

- id BIGINT NOT NULL
- employee_id BIGINT NOT NULL REFERENCES employee(id)
- period_start DATE NOT NULL
- period_end DATE NOT NULL
- regular_hours DECIMAL(6,2) NOT NULL DEFAULT 0
- ot_hours DECIMAL(6,2) NOT NULL DEFAULT 0
- pw_hours DECIMAL(6,2) NOT NULL DEFAULT 0
- pw_ot_hours DECIMAL(6,2) NOT NULL DEFAULT 0
- hourly_rate DECIMAL(10,2) NOT NULL
- ot_rate DECIMAL(10,2) NOT NULL
- pw_rate DECIMAL(10,2)
- pw_ot_rate DECIMAL(10,2)
- total_expenses DECIMAL(10,2) NOT NULL DEFAULT 0
- total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0
- total_salary DECIMAL(12,2) NOT NULL
- pay_stub_url TEXT
- synced_to_quickbooks BOOLEAN NOT NULL DEFAULT FALSE
- synced_to_gusto BOOLEAN NOT NULL DEFAULT FALSE
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## equipment_type

- id BIGINT NOT NULL
- name VARCHAR(100) NOT NULL
- default_cost DECIMAL(10,2)

## equipment

- id BIGINT NOT NULL
- equipment_type_id BIGINT NOT NULL REFERENCES equipment_type(id)
- name VARCHAR(150) NOT NULL
- description TEXT
- cost_value DECIMAL(12,2)
- condition VARCHAR(30) — good | fair | needs_repair | out_of_service
- status VARCHAR(20) NOT NULL DEFAULT 'available' — available | assigned | maintenance
- current_latitude DECIMAL(10,7)
- current_longitude DECIMAL(10,7)
- next_maintenance_date DATE
- total_usage_hours DECIMAL(8,1) NOT NULL DEFAULT 0
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## equipment_maintenance_log

- id BIGINT NOT NULL
- equipment_id BIGINT NOT NULL REFERENCES equipment(id)
- maintenance_type VARCHAR(50) NOT NULL
- description TEXT
- cost DECIMAL(10,2)
- performed_at DATE NOT NULL
- performed_by BIGINT REFERENCES employee(id)

## equipment_repair_request

- id BIGINT NOT NULL
- equipment_id BIGINT NOT NULL REFERENCES equipment(id)
- requested_by BIGINT NOT NULL REFERENCES employee(id)
- description TEXT NOT NULL
- status VARCHAR(20) NOT NULL DEFAULT 'open' — open | in_progress | resolved
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- resolved_at TIMESTAMPTZ

---

## vehicle

- id BIGINT NOT NULL
- vehicle_type VARCHAR(50)
- name VARCHAR(150) NOT NULL
- cost_per_vehicle DECIMAL(10,2)
- condition VARCHAR(30)
- fuel_type VARCHAR(20)
- fuel_consumption_rate DECIMAL(6,2)
- current_latitude DECIMAL(10,7)
- current_longitude DECIMAL(10,7)
- next_maintenance_date DATE
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## vehicle_fuel_log

- id BIGINT NOT NULL
- vehicle_id BIGINT NOT NULL REFERENCES vehicle(id)
- gallons DECIMAL(8,2) NOT NULL
- cost DECIMAL(10,2) NOT NULL
- odometer_reading INT
- fueled_at DATE NOT NULL

---

## route

- id BIGINT NOT NULL
- entity_type VARCHAR(10) NOT NULL — crew | estimator
- crew_id BIGINT REFERENCES crew(id)
- employee_id BIGINT REFERENCES employee(id)
- route_date DATE NOT NULL
- start_latitude DECIMAL(10,7) NOT NULL
- start_longitude DECIMAL(10,7) NOT NULL
- end_latitude DECIMAL(10,7) NOT NULL
- end_longitude DECIMAL(10,7) NOT NULL
- is_optimized BOOLEAN NOT NULL DEFAULT FALSE
- total_distance_miles DECIMAL(8,2)
- total_travel_cost DECIMAL(10,2)
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## route_waypoint

- id BIGINT NOT NULL
- route_id BIGINT NOT NULL REFERENCES route(id)
- work_order_id BIGINT REFERENCES work_order(id)
- task_id BIGINT REFERENCES task(id)
- latitude DECIMAL(10,7) NOT NULL
- longitude DECIMAL(10,7) NOT NULL
- sort_order SMALLINT NOT NULL
- estimated_arrival TIMESTAMPTZ

---

## gps_location_record

- id BIGINT NOT NULL
- entity_type VARCHAR(15) NOT NULL — employee | vehicle | equipment
- employee_id BIGINT REFERENCES employee(id)
- vehicle_id BIGINT REFERENCES vehicle(id)
- equipment_id BIGINT REFERENCES equipment(id)
- latitude DECIMAL(10,7) NOT NULL
- longitude DECIMAL(10,7) NOT NULL
- recorded_at TIMESTAMPTZ NOT NULL

---

## voip_call

- id BIGINT NOT NULL
- direction VARCHAR(10) NOT NULL — inbound | outbound
- from_number VARCHAR(30) NOT NULL
- to_number VARCHAR(30) NOT NULL
- caller_name VARCHAR(200)
- client_id BIGINT REFERENCES client(id)
- agent_id BIGINT REFERENCES employee(id)
- call_status VARCHAR(15) NOT NULL — active | completed | missed | voicemail
- recording_url TEXT
- recording_length_seconds INT
- is_read BOOLEAN NOT NULL DEFAULT FALSE
- started_at TIMESTAMPTZ NOT NULL
- ended_at TIMESTAMPTZ

## sms_message

- id BIGINT NOT NULL
- client_id BIGINT REFERENCES client(id)
- employee_id BIGINT REFERENCES employee(id)
- direction VARCHAR(10) NOT NULL — inbound | outbound
- from_number VARCHAR(30) NOT NULL
- to_number VARCHAR(30) NOT NULL
- body TEXT NOT NULL
- status VARCHAR(15) NOT NULL — sent | delivered | failed
- sent_at TIMESTAMPTZ NOT NULL

## email_log

- id BIGINT NOT NULL
- client_id BIGINT REFERENCES client(id)
- employee_id BIGINT REFERENCES employee(id)
- direction VARCHAR(10) NOT NULL — inbound | outbound
- from_address VARCHAR(255) NOT NULL
- to_address VARCHAR(255) NOT NULL
- subject VARCHAR(500)
- body_html TEXT
- template_id BIGINT REFERENCES email_template(id)
- status VARCHAR(15) — sent | opened | clicked | bounced
- sent_at TIMESTAMPTZ NOT NULL

---

## email_template

- id BIGINT NOT NULL
- name VARCHAR(150) NOT NULL
- subject VARCHAR(500) NOT NULL
- body_html TEXT NOT NULL
- template_type VARCHAR(15) NOT NULL DEFAULT 'custom' — custom | system
- is_news_template BOOLEAN NOT NULL DEFAULT FALSE
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

## email_template_variable

- id BIGINT NOT NULL
- template_id BIGINT NOT NULL REFERENCES email_template(id)
- variable_key VARCHAR(50) NOT NULL — e.g. NAME, ADDRESS, ESTIMATE_NUMBER
- description VARCHAR(200)

---

## programmed_message

- id BIGINT NOT NULL
- name VARCHAR(150) NOT NULL
- channel VARCHAR(15) NOT NULL — email | sms | both
- trigger_event VARCHAR(50) NOT NULL — lead_created | estimate_sent | estimate_confirmed | job_completed | invoice_sent | payment_received | season_change | service_reminder | follow_up | welcome | anniversary
- delay_minutes INT NOT NULL DEFAULT 0
- email_template_id BIGINT REFERENCES email_template(id)
- sms_body TEXT
- is_active BOOLEAN NOT NULL DEFAULT TRUE

## programmed_message_target

- programmed_message_id BIGINT NOT NULL REFERENCES programmed_message(id)
- tag_id BIGINT REFERENCES tag(id)
- client_id BIGINT REFERENCES client(id)

---

## newsletter

- id BIGINT NOT NULL
- email_template_id BIGINT NOT NULL REFERENCES email_template(id)
- subject_override VARCHAR(500)
- sent_at TIMESTAMPTZ
- total_recipients INT
- open_count INT
- click_count INT
- payment_count INT

## newsletter_audience

- newsletter_id BIGINT NOT NULL REFERENCES newsletter(id)
- tag_id BIGINT NOT NULL REFERENCES tag(id)

---

## internal_message

- id BIGINT NOT NULL
- sender_id BIGINT NOT NULL REFERENCES employee(id)
- recipient_id BIGINT NOT NULL REFERENCES employee(id)
- body TEXT NOT NULL
- is_read BOOLEAN NOT NULL DEFAULT FALSE
- sent_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## safety_form

- id BIGINT NOT NULL
- work_order_id BIGINT NOT NULL REFERENCES work_order(id)
- jha_content JSONB NOT NULL
- ppe_checklist JSONB NOT NULL
- is_completed BOOLEAN NOT NULL DEFAULT FALSE
- completed_at TIMESTAMPTZ
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## safety_form_signoff

- id BIGINT NOT NULL
- safety_form_id BIGINT NOT NULL REFERENCES safety_form(id)
- employee_id BIGINT NOT NULL REFERENCES employee(id)
- signed_at TIMESTAMPTZ NOT NULL

---

## incident_report

- id BIGINT NOT NULL
- safety_form_id BIGINT REFERENCES safety_form(id)
- work_order_id BIGINT REFERENCES work_order(id)
- latitude DECIMAL(10,7)
- longitude DECIMAL(10,7)
- description TEXT NOT NULL
- crew_statements TEXT
- is_near_miss BOOLEAN NOT NULL DEFAULT FALSE
- resolution_status VARCHAR(20) NOT NULL DEFAULT 'open' — open | resolved
- occurred_at TIMESTAMPTZ NOT NULL
- resolved_at TIMESTAMPTZ
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## incident_report_photo

- id BIGINT NOT NULL
- incident_report_id BIGINT NOT NULL REFERENCES incident_report(id)
- photo_url TEXT NOT NULL
- uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## custom_form_definition

- id BIGINT NOT NULL
- name VARCHAR(150) NOT NULL
- formio_schema JSONB NOT NULL
- trigger_type VARCHAR(20) NOT NULL — clock_in | clock_out | job_start | job_finish | scheduling | custom
- is_mandatory BOOLEAN NOT NULL DEFAULT FALSE
- repetition_days VARCHAR(20) — e.g. mon,wed,fri or daily
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## custom_form_role_assignment

- custom_form_definition_id BIGINT NOT NULL REFERENCES custom_form_definition(id)
- role_id BIGINT NOT NULL REFERENCES role(id)

## custom_form_submission

- id BIGINT NOT NULL
- form_definition_id BIGINT NOT NULL REFERENCES custom_form_definition(id)
- employee_id BIGINT NOT NULL REFERENCES employee(id)
- work_order_id BIGINT REFERENCES work_order(id)
- submission_data JSONB NOT NULL
- submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## quality_assurance_record

- id BIGINT NOT NULL
- assurance_type VARCHAR(15) NOT NULL — suggestion | complaint | compliment
- incident_type VARCHAR(50)
- cause_of_incident TEXT
- severity_rating SMALLINT
- description TEXT NOT NULL
- status VARCHAR(15) NOT NULL DEFAULT 'open' — open | resolved
- source_channel VARCHAR(15) NOT NULL — internal | email | sms | phone
- client_id BIGINT REFERENCES client(id)
- work_order_id BIGINT REFERENCES work_order(id)
- responsible_crew_id BIGINT REFERENCES crew(id)
- corrective_action TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- resolved_at TIMESTAMPTZ

---

## tree_marker

- id BIGINT NOT NULL
- client_id BIGINT REFERENCES client(id)
- latitude DECIMAL(10,7) NOT NULL
- longitude DECIMAL(10,7) NOT NULL
- address VARCHAR(255)
- marker_type VARCHAR(20) NOT NULL — trimming | removing | stump_removal | other
- risk_level VARCHAR(10) — low | medium | high | critical
- health_status VARCHAR(30)
- species VARCHAR(100)
- life_expectancy_years SMALLINT
- maintenance_needs TEXT
- description TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

## tree_marker_photo

- id BIGINT NOT NULL
- tree_marker_id BIGINT NOT NULL REFERENCES tree_marker(id)
- photo_url TEXT NOT NULL
- latitude DECIMAL(10,7)
- longitude DECIMAL(10,7)
- uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()

## tree_marker_hazard

- id BIGINT NOT NULL
- tree_marker_id BIGINT NOT NULL REFERENCES tree_marker(id)
- hazard_type VARCHAR(50) NOT NULL — hornet_nest | power_line | roof | fence | other
- description TEXT
- latitude DECIMAL(10,7)
- longitude DECIMAL(10,7)

---

## municipal_tree_inventory

- id BIGINT NOT NULL
- tree_marker_id BIGINT REFERENCES tree_marker(id)
- asset_category VARCHAR(30) NOT NULL — tree | stump | planter | garden_bed | other
- department_id BIGINT REFERENCES department(id)
- health_history JSONB
- past_maintenance_records JSONB
- future_care_schedule JSONB
- total_cost_to_date DECIMAL(12,2) NOT NULL DEFAULT 0
- custom_fields JSONB
- public_dashboard_visible BOOLEAN NOT NULL DEFAULT FALSE
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

## department

- id BIGINT NOT NULL
- name VARCHAR(100) NOT NULL — urban_forestry | parks | public_works | contractors

## department_user

- department_id BIGINT NOT NULL REFERENCES department(id)
- employee_id BIGINT NOT NULL REFERENCES employee(id)
- department_role VARCHAR(30)

---

## chemical_application

- id BIGINT NOT NULL
- work_order_id BIGINT REFERENCES work_order(id)
- tree_marker_id BIGINT REFERENCES tree_marker(id)
- applicator_id BIGINT NOT NULL REFERENCES employee(id)
- chemical_name VARCHAR(200) NOT NULL
- treatment_type VARCHAR(50)
- application_rate VARCHAR(50)
- quantity DECIMAL(10,3)
- quantity_unit VARCHAR(20)
- application_date DATE NOT NULL
- regulatory_data JSONB
- notes TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## service

- id BIGINT NOT NULL
- name VARCHAR(150) NOT NULL
- default_description TEXT
- default_price DECIMAL(12,2)
- default_crew_id BIGINT REFERENCES crew(id)
- default_mhr_rate DECIMAL(10,2)
- default_markup_pct DECIMAL(5,2)
- default_overhead_pct DECIMAL(5,2)
- is_taxable BOOLEAN NOT NULL DEFAULT TRUE
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## service_equipment_type

- service_id BIGINT NOT NULL REFERENCES service(id)
- equipment_type_id BIGINT NOT NULL REFERENCES equipment_type(id)

## product

- id BIGINT NOT NULL
- name VARCHAR(150) NOT NULL
- description TEXT
- price DECIMAL(12,2) NOT NULL
- is_non_taxable BOOLEAN NOT NULL DEFAULT FALSE
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## bundle

- id BIGINT NOT NULL
- name VARCHAR(150) NOT NULL
- price_override DECIMAL(12,2)
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## bundle_item

- bundle_id BIGINT NOT NULL REFERENCES bundle(id)
- item_type VARCHAR(10) NOT NULL — service | product
- service_id BIGINT REFERENCES service(id)
- product_id BIGINT REFERENCES product(id)
- quantity SMALLINT NOT NULL DEFAULT 1

---

## task

- id BIGINT NOT NULL
- description TEXT NOT NULL
- is_urgent BOOLEAN NOT NULL DEFAULT FALSE
- assigned_to BIGINT NOT NULL REFERENCES employee(id)
- task_category_id BIGINT REFERENCES task_category(id)
- status VARCHAR(10) NOT NULL DEFAULT 'new' — new | done
- scheduled_at TIMESTAMPTZ
- latitude DECIMAL(10,7)
- longitude DECIMAL(10,7)
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- completed_at TIMESTAMPTZ

## task_category

- id BIGINT NOT NULL
- name VARCHAR(100) NOT NULL
- color VARCHAR(7)
- use_in_route_optimization BOOLEAN NOT NULL DEFAULT FALSE
- location_required BOOLEAN NOT NULL DEFAULT FALSE

---

## expense

- id BIGINT NOT NULL
- expense_type_id BIGINT NOT NULL REFERENCES expense_type(id)
- amount DECIMAL(12,2) NOT NULL
- description TEXT
- work_order_id BIGINT REFERENCES work_order(id)
- employee_id BIGINT REFERENCES employee(id)
- incurred_date DATE NOT NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## expense_type

- id BIGINT NOT NULL
- name VARCHAR(100) NOT NULL
- category VARCHAR(50)

---

## report_definition

- id BIGINT NOT NULL
- name VARCHAR(200) NOT NULL
- category VARCHAR(50) NOT NULL — sales | scheduling | invoicing | accounting | work_order | personnel | financial | marketing | equipment
- is_default BOOLEAN NOT NULL DEFAULT TRUE
- custom_fields_json JSONB
- sort_criteria VARCHAR(50)
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## activity_log

- id BIGINT NOT NULL
- employee_id BIGINT NOT NULL REFERENCES employee(id)
- activity_type VARCHAR(50) NOT NULL
- entity_type VARCHAR(30)
- entity_id BIGINT
- ip_address INET
- details TEXT
- occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()

---

## integration_sync_log

- id BIGINT NOT NULL
- provider VARCHAR(30) NOT NULL — quickbooks | sage | xero | gusto | authorize_net | cardpointe | wisetack | mailchimp
- entity_type VARCHAR(30) NOT NULL
- entity_id BIGINT NOT NULL
- external_id VARCHAR(255)
- direction VARCHAR(10) NOT NULL — push | pull | bidirectional
- status VARCHAR(15) NOT NULL — success | failed | pending
- error_message TEXT
- synced_at TIMESTAMPTZ NOT NULL DEFAULT now()

## authorize_net_fraud_filter

- id BIGINT NOT NULL
- filter_type VARCHAR(40) NOT NULL — daily_velocity | hourly_velocity | suspicious_transaction | transaction_ip_velocity | enhanced_avs | enhanced_ccv | amount_filter
- threshold_value VARCHAR(50)
- is_active BOOLEAN NOT NULL DEFAULT TRUE
