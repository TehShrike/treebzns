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

Do next time: add a role table and permissions table

---

## company

- company_id BIGINT NOT NULL
- name VARCHAR(500) NOT NULL
- logo BLOB
- brand_color VARCHAR(20)
- default_initial_project_document_id BIGINT NOT NULL (Lead, Unqualified)

---

## client

- client_id BIGINT NOT NULL
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

- client_contact_id BIGINT NOT NULL
- client_id BIGINT NOT NULL REFERENCES client(client_id)
- contact_name VARCHAR(200) NOT NULL
- phone VARCHAR(30)
- email VARCHAR(500)
- is_primary BOOLEAN NOT NULL DEFAULT FALSE
- sort_order SMALLINT NOT NULL DEFAULT 0

## client_address
- client_address_id BIGINT NOT NULL
- client_id BIGINT NOT NULL REFERENCES client(client_id)
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

- project_id BIGINT NOT NULL
- project_document BIGINT NOT NULL
- client_id BIGINT NOT NULL REFERENCES client(client_id)
- client_address_id BIGINT NOT NULL
- address_line_1 VARCHAR(500)
- address_line_2 VARCHAR(500)
- city VARCHAR(100)
- state VARCHAR(50)
- zip VARCHAR(20)
- due_date DATE
- emergency BOOLEAN
- assigned_estimator_employee_id BIGINT REFERENCES employee(employee_id)
- details TEXT
- created_by_employee_id BIGINT REFERENCES employee(employee_id)
- created_at DATETIME NOT NULL DEFAULT now()
- updated_at DATETIME NOT NULL DEFAULT now()
- needs_client_approval BOOLEAN NOT NULL
- sent_for_client_approval BOOLEAN NOT NULL
- tax_rate_id BIGINT
- tax_rate DECIMAL(6,4)
- notes_for_crew TEXT
- notes_for_office TEXT
- closed: BOOLEAN
- closed_at DATETIME
- closed_date DATE

## project_document

- project_document_id BIGINT NOT NULL
- group_name
- name
- needs_estimate_to_move_on
- needs_client_approval_to_move_on BOOLEAN
- can_expire
- expire_days
- next_project_document_id BIGINT
- should_be_worked BOOLEAN
- needs_to_be_contacted_by_lead_qualifier
- can_be_closed
- represents_billable_sale_when_closed

```
Example:

Lead, Unqualified, needs_to_be_contacted_by_lead_qualifier, next_project_document: Qualified Lead
Lead, Qualified, needs_estimate_to_move_on, next_project_document: Estimate
Estimate, '', needs_client_approval_to_move_on, can_expire, next_project_document: Work Order
Work Order, '', should_be_worked, can_be_closed, represents_billable_sale_when_closed
Work Order, Errand, should_be_worked, can_be_closed
Work Order, Customer Sat, should_be_worked, can_be_closed
Void, ''

maybe estimate "needs double-checked by foreman" and "sent to customer"?  Nah, those probably go on the documents, at least the "sent to customer" does.

Current thought is that documents would have a "move on" action, which can be done by anyone who can work the current document type, and either turns it into the next_project_document, or finalizes it.
```

## item_type

- item_type_id BIGINT NOT NULL
- name

```
Stump grinding, limb removal, tree removal, tree planting, injecting
```

## project_line_item

- project_line_item_id BIGINT NOT NULL
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
- added_by_employee_id BIGINT
- created_at DATETIME NOT NULL DEFAULT now()

---

## payment

- payment_id BIGINT NOT NULL
- work_order_id BIGINT NOT NULL REFERENCES work_order(work_order_id)
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

- employee_id BIGINT NOT NULL
- company_id BIGINT NOT NULL
- name VARCHAR(100) NOT NULL
- email VARCHAR(500) NOT NULL
- phone VARCHAR(30)
- password_hash VARCHAR(500) NOT NULL
- role_id BIGINT NOT NULL REFERENCES role(role_id)
- avatar_url TEXT
- created_at DATETIME NOT NULL DEFAULT now()
- updated_at DATETIME NOT NULL DEFAULT now()

---

## crew

- crew_id BIGINT NOT NULL
- crew_leader_id BIGINT NOT NULL REFERENCES employee(employee_id)
- color VARCHAR(7) — hex code
- created_at DATETIME NOT NULL DEFAULT now()

## crew_member

- crew_id BIGINT NOT NULL REFERENCES crew(crew_id)
- employee_id BIGINT NOT NULL REFERENCES employee(employee_id)

## role

- role_id
- name

## role_permission

- role_id
- permission_id

## permission

- permission_id
- code
- name

```
CAN_CREATE_ORDER
CAN_CREATE_CLIENT
CAN_EDIT_CLIENT
CAN_QUALIFY_LEAD
CAN_ESTIMATE
CAN_WORK_CREW
CAN_CHOOSE_ANY_DOCUMENT_STATUS
```

---

## time_entry

- time_entry_id BIGINT NOT NULL
- employee_id BIGINT NOT NULL REFERENCES employee(employee_id)
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

- sms_message_id BIGINT NOT NULL
- client_id BIGINT REFERENCES client(client_id)
- employee_id BIGINT REFERENCES employee(employee_id)
- direction VARCHAR(10) NOT NULL — inbound | outbound
- from_number VARCHAR(30) NOT NULL
- to_number VARCHAR(30) NOT NULL
- body TEXT NOT NULL
- status VARCHAR(15) NOT NULL — sent | delivered | failed
- sent_at DATETIME NOT NULL

## email_log

- email_log_id BIGINT NOT NULL
- client_id BIGINT REFERENCES client(client_id)
- employee_id BIGINT REFERENCES employee(employee_id)
- direction VARCHAR(10) NOT NULL — inbound | outbound
- from_address VARCHAR(500) NOT NULL
- to_address VARCHAR(500) NOT NULL
- subject VARCHAR(500)
- body_html TEXT
- status VARCHAR(15) — sent | opened | clicked | bounced
- sent_at DATETIME NOT NULL

---

## tax_rate

- tax_rate_id: BIGINT NOT NULL
- name: VARCHAR(200)
- tax_rate: DECIMAL(6,4)

