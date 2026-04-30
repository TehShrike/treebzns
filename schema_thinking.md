# Arborist CRM — SQL Schema

### probable todo

upload files to: work orders.  Need to be able to upload files and attach them to different documents.

add actual permission scheme
- how are hour estimates done versus number of people on the job?
- currently picks roles needed for the team that will work the lead, e.g. "stump grinder" "groundsman" "climber"
- roles have an hourly rate.  Take the average of all the roles assigned to get the blended hourly rate.  Multiply that by the estimated hours for the probable dollar amount.
- common case: regular crews with set people, but then people will get dragged to a new crew just for one day.  Video game character/crew assignment UI applies
- would be nice to send out notifications to clients Friday afternoon/over the weekend, e.g. "we're currently planning to come out on Wednesday"
	- this is optional.  Andrew freewheels it day to day right now, working down the list.
	- list of jobs coming up, in some order, showing how what day it would happen given current trajectory
- sales tax for tree planting, not services.
- don't want to show the materials/service breakdown for tree items.
- customer tree inventory
- seeing the images on line items
	- could experiment with horizontal line items rather than vertical, to show large images
	- could have normal mode (big images) and table mode (traditional skinny line items) when viewing online where you don't have to worry about number of printed pages
- one overarching document for lead->estimate->work order->invoice
	- attached files persist
- change orders: change the price of a line item, change the quantity of a line item, or add a new line item.
- don't need it in v1, but at least leave it open to support partial invoicing, where an invoice only covers some line items on a work order, and only finalizes those, rather than finalizing the whole work order.
- **project line items persist, projects change status, lead->estimate->work order**
- consider GPS coordinates for customer addresses/locations so you could note the driveway location
- combine estimate/work order into one document with one line item
- projects have lead notes, leads *could* have invoices but probably won't in practice
- Andrew wants schedule statuses – some things that require a line drop, can not move on the schedule.  Everything else moves around them.
- flag job with "due dates"
- clocking in:
	- foreman does it for the crew
	- clock in when starting to drive, while pulling up the directions
		- this sends a confirmation text message
	- foreman can add someone in to the job later if they show up late
	- foreman's looking at instructions, taking pictures of work, or clocking out
- special projects like "pick up battery pack from this guy's place"
	- project with a special status
	- projects of different statuses are visible based on roles of the person
- review time_entry – should be clocking in to projects, nothing else
- a permission for being able to edit project line items without needing customer approval

---

## company

- id BIGINT NOT NULL
- name VARCHAR(500) NOT NULL
- logo BLOB
- brand_color VARCHAR(20)

---

## client

- id BIGINT NOT NULL
- name VARCHAR(500) NOT NULL
- primary_client_address_id BIGINT NOT NULL
- billing_client_address_id BIGINT NOT NULL
- primary_phone VARCHAR(30)
- primary_email VARCHAR(500)
- tax_rate_id BIGINT
- notes TEXT
- referred_by VARCHAR(500)
- created_at DATETIME NOT NULL DEFAULT now()
- updated_at DATETIME NOT NULL DEFAULT now()

## client_contact

- id BIGINT NOT NULL
- client_id BIGINT NOT NULL REFERENCES client(id)
- contact_name VARCHAR(200) NOT NULL
- phone VARCHAR(30)
- email VARCHAR(500)
- is_primary BOOLEAN NOT NULL DEFAULT FALSE
- sort_order SMALLINT NOT NULL DEFAULT 0

## client_address
- id BIGINT NOT NULL
- client_id BIGINT NOT NULL REFERENCES client(id)
- name
- address_line_1 VARCHAR(500)
- address_line_2 VARCHAR(500)
- city VARCHAR(100)
- state VARCHAR(50)
- zip VARCHAR(20)
- contact VARCHAR(500)
- phone VARCHAR(50)
- email VARCHAR(500)

---

## project

- id BIGINT NOT NULL
- client_id BIGINT NOT NULL REFERENCES client(id)
- client_address_id BIGINT NOT NULL
- address_line_1 VARCHAR(500)
- address_line_2 VARCHAR(500)
- city VARCHAR(100)
- state VARCHAR(50)
- zip VARCHAR(20)
- due date DATE
- emergency BOOLEAN
- assigned_estimator_id BIGINT REFERENCES employee(id)
- details TEXT
- created_by BIGINT REFERENCES employee(id)
- created_at DATETIME NOT NULL DEFAULT now()
- updated_at DATETIME NOT NULL DEFAULT now()
- needs_client_approval BOOLEAN NOT NULL
- sent_for_client_approval BOOLEAN NOT NULL
- tax_rate_id BIGINT
- tax_rate DECIMAL(6,4)
- notes_for_crew TEXT
- notes_for_office TEXT

## project_status

- project_status_id BIGINT NOT NULL
- group_name
- name
- requires_client_approval_to_move_to_next_status BOOLEAN
- next_project_status_id BIGINT
- should_be_worked BOOLEAN
- needs_review
- needs_estimate
- ready_to_bill BOOLEAN

```
Example:

Lead, Unqualified, needs_review
Lead, Qualified, needs_estimate
Estimate, '', requires_client_approval_to_move_to_next_status
Work Order, Workable, should_be_worked
Work Order, Invoice, ready_to_bill
```

## item_type

- item_type_id BIGINT NOT NULL
- name

## project_line_item

- project_line_item BIGINT NOT NULL
- project_id BIGINT NOT NULL
- description
- item_type_id
- taxable BOOLEAN
- quantity DECIMAL(10,2) NOT NULL
- price DECIMAL(10,2) NOT NULL

## project_line_item_image

- project_line_item_image_id BIGINT NOT NULL
- project_line_item_id
- image BLOB
- description

## project_client_approval

- project_client_approval_id BIGINT NOT NULL
- customer_signature BLOB
- verbal_approval BOOLEAN NOT NULL
- added_by_user_id BIGINT
- created_at DATETIME NOT NULL DEFAULT now()

---

## payment

- id BIGINT NOT NULL
- invoice_id BIGINT NOT NULL REFERENCES invoice(id)
- amount DECIMAL(12,2) NOT NULL
- tip_amount DECIMAL(12,2) NOT NULL DEFAULT 0
- payment_method VARCHAR(20) NOT NULL — cash | check | credit_card
- payment_provider VARCHAR(30) — authorize_net | cardpointe | xero | wisetack
- transaction_id VARCHAR(500)
- is_deposit BOOLEAN NOT NULL DEFAULT FALSE
- status VARCHAR(20) NOT NULL DEFAULT 'completed'
- transacted_at DATETIME NOT NULL DEFAULT now()

---

## employee

- id BIGINT NOT NULL
- company_id BIGINT NOT NULL
- name VARCHAR(100) NOT NULL
- email VARCHAR(500) NOT NULL
- phone VARCHAR(30)
- password_hash VARCHAR(500) NOT NULL
- role_id BIGINT NOT NULL REFERENCES role(id)
- avatar_url TEXT
- created_at DATETIME NOT NULL DEFAULT now()
- updated_at DATETIME NOT NULL DEFAULT now()

---

## crew

- id BIGINT NOT NULL
- crew_leader_id BIGINT NOT NULL REFERENCES employee(id)
- color VARCHAR(7) — hex code
- created_at DATETIME NOT NULL DEFAULT now()

## crew_member

- crew_id BIGINT NOT NULL REFERENCES crew(id)
- employee_id BIGINT NOT NULL REFERENCES employee(id)

---

## time_entry

- id BIGINT NOT NULL
- employee_id BIGINT NOT NULL REFERENCES employee(id)
- work_date DATE NOT NULL
- clock_in DATETIME NOT NULL
- clock_out DATETIME
- regular_hours DECIMAL(5,2) NOT NULL DEFAULT 0
- ot_hours DECIMAL(5,2) NOT NULL DEFAULT 0
- pw_hours DECIMAL(5,2) NOT NULL DEFAULT 0
- pw_ot_hours DECIMAL(5,2) NOT NULL DEFAULT 0
- expenses DECIMAL(10,2) NOT NULL DEFAULT 0
- deductions DECIMAL(10,2) NOT NULL DEFAULT 0
- total_hours DECIMAL(5,2) GENERATED ALWAYS AS (regular_hours + ot_hours + pw_hours + pw_ot_hours)
- total_pay DECIMAL(10,2)
- manually_adjusted BOOLEAN NOT NULL DEFAULT FALSE
- created_at DATETIME NOT NULL DEFAULT now()

---

## sms_message

- id BIGINT NOT NULL
- client_id BIGINT REFERENCES client(id)
- employee_id BIGINT REFERENCES employee(id)
- direction VARCHAR(10) NOT NULL — inbound | outbound
- from_number VARCHAR(30) NOT NULL
- to_number VARCHAR(30) NOT NULL
- body TEXT NOT NULL
- status VARCHAR(15) NOT NULL — sent | delivered | failed
- sent_at DATETIME NOT NULL

## email_log

- id BIGINT NOT NULL
- client_id BIGINT REFERENCES client(id)
- employee_id BIGINT REFERENCES employee(id)
- direction VARCHAR(10) NOT NULL — inbound | outbound
- from_address VARCHAR(500) NOT NULL
- to_address VARCHAR(500) NOT NULL
- subject VARCHAR(500)
- body_html TEXT
- template_id BIGINT REFERENCES email_template(id)
- status VARCHAR(15) — sent | opened | clicked | bounced
- sent_at DATETIME NOT NULL

---

## tax_rate

- tax_rate_id: BIGINT NOT NULL
- name: VARCHAR(200)
- tax_rate: DECIMAL(6,4)
