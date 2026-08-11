# Model changes needed for the screen buildout

Comparison of `screens_needed.md` against the current schema (through migration 0031).

Two sections: open questions that need product decisions, and clear gaps that just need migrations.

## Open questions

### 1. How do we assign a job to a crew and a day?

Nothing links a project to a crew or a date today.  The job scheduling screen, the work crew interface, and the worker/foreman screen all need this link.  The customer work order screen needs it too, for the "when will you come out" estimate.

Options:

- **`scheduled_work` table**: project_id, crew_id, work_date, sort_order, locked.  One row per crew-day.  A multi-day job gets multiple rows.  `locked` covers line-drop jobs that can not move on the schedule.
- **Columns on project**: scheduled_date + crew_id on the project row.  Simplest, but a job can only ever be one day and one crew.

Sub-question: can one job span multiple days or multiple crews?  The answer decides between these.

#### Answer

This is tied together with the answer to question 2.

Crews are long-lived across many days.  Crews should not have a "leader" right now, we will gate the ability to check everyone in at a job using a permission instead.  Each crew will represent one timeline that jobs can be scheduled on during a day.

The crew_member table can be renamed to crew_regular.  It will serve as a default set of employees, not a hard rule.

We should have a record of when crew members are added to and removed to a crew in crew_regular.  This will probably come up again, we should establish a future-proof predictable pattern for "history" tables.

##### Scheduling

A project_crew table that contains: a project id, a crew id, a day/date, an order (unique tinyint per day), and a time.  Must be unique on project+crew+day.  order and time are both nullable, at least one of them must be null and the other must be non-null (can be at least somewhat enforced with the type system in TS).

A project_crew_employee table that links a project_crew_id to any number of employee_ids (unique key covering both).

A project_crew_project_line_item table that links a project_crew_id to any number of project_line_item_ids (with the assumption that they will have the same project_id as the corresponding project_crew).

The company table will need a default_crew_start_time column.

### 2. How do we model day-specific crew composition?

People get pulled to another crew for one day.  `crew_member` is a static roster and can not express that.  The "video game character assignment" UI needs to edit something per-day.

Options:

- **Roster + day overrides**: keep `crew_member` as the default.  Add `crew_day_member` (crew_id, employee_id, work_date, added/removed flag).  The crew on a date = roster ± overrides.
- **Static crews only for v1**: no day moves in the model.  `time_entry` records who actually worked.
- **Per-day snapshots**: every workday's crew is explicit rows, copied forward from the previous day.  `crew_member` goes away.

### 3. Where do skill requirements live?

Skills attach only to projects today (`project_work_skill`).  The notes say line items define the skills/equipment needed.  The scheduling screen matches project requirements against crew capabilities, so it needs a clear rollup rule.

Options:

- **Line items, rolled up**: new `project_line_item_work_skill` table.  A project's requirements = union of its line items' skills.  Keep `project_work_skill` for lead-stage projects that have no line items yet.
- **Project level only**: keep the current table as the one place.  Simpler, but you can not see which line item needs the crane.

#### Answer

We will replace project_work_skill with project_line_item_work_skill.

Other line item changes: line items should have a title, as well as a description.  The title will be a short name, more generic, and can be used on invoices where the full work details are not needed.  Rename `description` to `work_details`.

We should also add a line_item_template table with company_id + title, and a line_item_template_work_skill table.  work_types from arbostar can be imported into line_item_template.

project_line_item should have a nullable line_item_template_id column for informational purposes.

### 4. Is equipment separate from work skills?

The settings screen says "skill/equipment list".  Skills belong to people.  Equipment belongs to the company or a crew.  That difference may or may not matter to the schedule.

Options:

- **One list**: equipment items are `work_skill` rows with no hourly_rate ("crane", "bucket truck").  One tagging system, one settings list.
- **Separate tables**: an `equipment` table with its own join tables.  More tables, but scheduling could later track which crew has the crane on which day.

#### Answer

I'm not modeling equipment explicitly yet.  Some equipment use is implicit in work skills, and that's fine for now.

### 5. How do project photos work before line items exist?

The estimating flow is: dump in photos, dump in text, then pull it apart into line items.  Today photos only exist as `project_line_item_image`, so a photo can not exist before its line item does.

Proposed shape, needs confirmation:

- New `project_image` table at the project level: image, description, visible_to_client, markup data.
- Linking photos to line items: nullable FK on the image, or a join table so one photo can illustrate several line items?
- Markup: store the marked-up render, the overlay data (JSON), or both?

#### Answer

New `project_image` table at the project level: original_image, description, display_image (potentially marked up).

New project_line_item_image table that represent a M:N relationship between `project_image`s and line items, with a visible_to_client boolean.

### 6. Where do image bytes live?

Current schema stores images as BLOBs in MySQL.  Estimators will dump in many large photos.  This runs on Cloudflare Workers, where R2 is the natural object store.

Options: keep BLOBs in MySQL for simplicity, or store bytes in R2 and keep only keys + metadata in MySQL.  Affects the offline/Cloudflare-downtime resiliency goal from big_todos.

#### Answer

Blobs in MySQL for now.

### 7. How does the customer reach the customer-facing project screen?

No access mechanism exists.  The proposal, work order, and invoice screens all need one.

Options: an unguessable token column (or table) per project baked into the URL, or a real client login.  A token is the likely v1.  Sub-question: does the token ever expire or get revoked?

#### Answer

This is not a schema modelling concern, at least not for today.  The url will contain the project number.  There will be some unguessable value, maybe in the querystring, maybe a hash of company_id + project_id.

### 8. How do we record what the customer approved?

`project_client_approval` has no project_id today, so an approval can not attach to a project at all.  Beyond that fix: the proposal screen offers "just the basics" / "approve all" / "extra mile", so an approval selects a subset of line items.

Questions:

- Record the approved line item set per approval event (join table), or is `client_declined` on the line item enough?
- Snapshot prices at approval time, or trust that line items do not change after approval (the CAN_CHANGE_WORK_ORDERS_WITHOUT_CUSTOMER_APPROVAL permission implies they can)?
- Down payments come later, but the approval shape should leave room.

#### Answer

Declining line items is very different from approving a project.  Declined line items are only relevant on a project that has been approved.  Once a project has been approved, its status will change and it will become workable.  This is modeled correctly already as far as I am aware.

Yes, limiting edit access to work items is the way prices get locked down.

### 9. Are "optional" and "add-on" the same flag?

Line items have `client_optional` today.  The proposal CTA describes "just the basics" (excludes optional) and "extra mile" (includes add-ons) as different tiers.  If those are distinct, line items need two flags.  If not, the CTA is two tiers, not three.

#### Answer

I'll need to have more discussions about those CTAs, let's not make any changes for now, we'll continue with just optional line items today, we'll show a single price on the customer-facing proposal screen, and clients will have the option to decline work line items.

### 10. Do we bake client contact info onto the project?

The project screen notes say address and contact info should be baked into the document, not read from the client record.  Address columns are already copied onto the project.  Client name, phone, and email are not.  Decide whether to copy them at some transition point (estimate sent?) or keep reading them live.

#### Answer

Add a contact_name, contact_phone, contact_email varchar to the project table.  They'll be written at lead creation time same as the address.

## Clear gaps (no product decision expected, just migrations)

- **`project_document_history`**: project_id, project_document_id, changed_by_employee_id, created_at.  The project screen shows transition dates, and expiration math needs the timestamp of the transition into the expiring document.  Flagged in screens_needed already.
- **`project_client_approval.project_id`**: missing FK, approvals are orphaned today.
- **`crew.name`**: crews have a color and a leader but no name.
- **`employee_work_skill`**: employee_id + work_skill_id.  "Crews have workers with different skills" has no data behind it today.  Scheduling and the crew UI both need it.
- **Geocoding for the map view**: latitude/longitude columns (floating point) on project (and maybe client_address).  Also decide which geocoding service fills them, but the columns are needed regardless.
- **`project_image.visible_to_client`**: the "visible to customer" checkbox from todo.md, wherever the photo model lands (see question 5).

## Plan

Schema changes only.  Conventions follow the existing schema: INT UNSIGNED auto-increment ids, BIT(1) booleans, created_at/updated_at DATETIME with UTC_TIMESTAMP defaults, indexes instead of FK constraints, company_id on every company-owned table.

History table pattern, used here and in the future: a sibling `<name>_history` table.  It mirrors the tracked key columns, adds an `action` column when the change is not a plain "set", plus changed_by_employee_id and created_at.  History tables are append-only, so they get created_at but no updated_at.  The live table stays authoritative.

### Crews

- `crew`: drop `crew_leader_id`.  Add `name` VARCHAR(100) NOT NULL.
- Rename `crew_member` to `crew_regular`.  Columns unchanged.
- New `crew_regular_history`:
	- crew_regular_history_id
	- company_id
	- crew_id
	- employee_id
	- action VARCHAR(20) NOT NULL — 'added' | 'removed'
	- changed_by_employee_id
	- created_at

### Scheduling

- New `project_crew`:
	- project_crew_id
	- company_id
	- project_id
	- crew_id
	- work_date DATE NOT NULL
	- day_order TINYINT UNSIGNED NULL — position in the crew's timeline for that day
	- start_time TIME NULL — fixed-time jobs instead of ordered jobs
	- UNIQUE (project_id, crew_id, work_date)
	- UNIQUE (crew_id, work_date, day_order)
	- Exactly one of day_order/start_time is non-null.  Enforced in TS, not in the database.
- New `project_crew_employee`:
	- project_crew_employee_id
	- company_id
	- project_crew_id
	- employee_id
	- UNIQUE (project_crew_id, employee_id)
- New `project_crew_project_line_item`:
	- project_crew_project_line_item_id
	- company_id
	- project_crew_id
	- project_line_item_id — assumed to share the project_crew's project_id
	- UNIQUE (project_crew_id, project_line_item_id)
- `company`: add `default_crew_start_time` TIME NOT NULL DEFAULT '08:00:00'.

### Skills and line items

- New `employee_work_skill`:
	- employee_work_skill_id
	- company_id
	- employee_id
	- work_skill_id
	- UNIQUE (employee_id, work_skill_id)
- New `project_line_item_work_skill`:
	- project_line_item_work_skill_id
	- company_id
	- project_line_item_id
	- work_skill_id
	- UNIQUE (project_line_item_id, work_skill_id)
- Drop `project_work_skill`.
- New `line_item_template`:
	- line_item_template_id
	- company_id
	- title VARCHAR(200) NOT NULL
	- arbostar_work_type_id INT UNSIGNED NULL — import bookkeeping, same pattern as the other arbostar_* columns
	- UNIQUE (company_id, title)
- New `line_item_template_work_skill`:
	- line_item_template_work_skill_id
	- company_id
	- line_item_template_id
	- work_skill_id
	- UNIQUE (line_item_template_id, work_skill_id)
- `project_line_item`:
	- add `title` VARCHAR(200) NOT NULL DEFAULT ''
	- rename `description` to `work_details`
	- add `line_item_template_id` INT UNSIGNED NULL

### Photos

- New `project_image`:
	- project_image_id
	- company_id
	- project_id
	- original_image MEDIUMBLOB NOT NULL — the existing image column is BLOB, which caps at 64KB.  Real photos need MEDIUMBLOB (16MB).
	- display_image MEDIUMBLOB NULL — the marked-up render.  NULL means not marked up, show the original.
	- description TEXT NOT NULL
	- visible_to_client BIT(1) NOT NULL DEFAULT 0
- Restructure `project_line_item_image` into a pure join table:
	- project_line_item_image_id
	- company_id
	- project_image_id
	- project_line_item_id
	- UNIQUE (project_image_id, project_line_item_id)
	- Migration moves each existing row's image and description into a new project_image row (project_id taken from the line item), then keeps only the link.

### Project

- `project_client_approval`: add `project_id` INT UNSIGNED NOT NULL plus an index.  Existing rows have no project to point at, so the migration must delete them or the table must be empty.
- New `project_document_history` (follows the history pattern, action implicit "set"):
	- project_document_history_id
	- company_id
	- project_id
	- project_document_id
	- changed_by_employee_id INT UNSIGNED NULL — NULL for system transitions
	- created_at
	- Migration seeds one row per existing project from its current project_document_id and created_at.
- `project`:
	- add `contact_name` VARCHAR(500) NOT NULL DEFAULT ''
	- add `contact_phone` VARCHAR(30) NOT NULL DEFAULT ''
	- add `contact_email` VARCHAR(500) NOT NULL DEFAULT ''
	- add `latitude` DOUBLE NULL
	- add `longitude` DOUBLE NULL
- `client_address`:
	- add `latitude` DOUBLE NULL
	- add `longitude` DOUBLE NULL
