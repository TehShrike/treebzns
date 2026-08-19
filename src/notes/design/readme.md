# Screen designs

Static HTML mockups for the screens in `src/notes/screens_needed.md`.  They exist to look at and argue
about.  No JavaScript, no data, no build step.

Open `src/notes/design/index.html` in a browser.  The pages load the app CSS from `src/public/`, so the controls
look like the app.

## What is here

| File | Screen | Design doc section |
| --- | --- | --- |
| `lead_create.html` | Create a lead | Creating a lead |
| `project_list.html` | Project list | Project list |
| `client.html` | Client | Client screen |
| `crews.html` | Crews | Work crew interface |
| `scheduling.html` | Job scheduling | Job scheduling |
| `foreman.html` | My jobs | Worker/foreman screen |
| `estimating.html` | Estimating | Estimating |
| `project.html` | Project | Project screen |
| `customer_proposal.html` | Customer proposal | Customer-facing, Proposal |
| `customer_work_order.html` | Customer work order | Customer-facing, Work order |
| `customer_invoice.html` | Customer invoice | Customer-facing, Closed work order |
| `settings.html` | Settings | Settings |

`mockup.css` styles the mockup frame: the page header, the fake menu, the note blocks.  Nothing in it
ships in the app.

## Reading a page

Each page has three parts:

1. A header that says what the screen is for.
2. The screen.
3. Design notes, with open questions in red.

Every page has a "Show column names" checkbox.  Turn it on to see the table and column behind each
control, for example `project.contact_phone`.  The column names come from `schema/current_schema.sql`.

## Decisions that cross every screen

- **A field label matches its column name.**  `project.lead_details` gets the label "Lead details",
  not "What they said".  Prose belongs in help text, not in labels.

- **The office app keeps the 98.css look.  The customer pages do not.**  The three customer pages load
  `global_variables.css` and `global_styles.css` but not `98.css`.  A person deciding whether to spend
  four thousand dollars should not read a Windows 98 dialog.  Both sets use the same CSS variables, so
  the brand color still drives them.
- **A project owns its own address and contact.**  Screens read `project.contact_name`,
  `contact_phone`, `contact_email`, and the address columns, not the client record.  Changing a client
  later does not move an open job.
- **The document drives the screen.**  `project_document` says what can happen next
  (`next_project_document_id`), what is off the happy path (`declined_project_document_id`), and what
  the customer page shows.  No screen has a hardcoded status list.
- **Skills are checked, not enforced.**  The schedule screen warns when a crew lacks a skill a job
  needs.  It does not block the assignment.
- **Money is written once and then copied.**  The proposal writes `project.total`.  Closing writes the
  `invoice` and `invoice_line_item` rows.  A customer's invoice never changes when a project is edited.

## Open questions that need a decision

These come up on more than one screen.  Each page repeats the ones that apply to it.

- **Clock-in records point at a project, not a visit.**  `time_entry.project_id` can not say which
  `project_crew` row the hours belong to.  The foreman screen and the hours panel on the project screen
  both need it.  `src/notes/todo.md` already lists this.
- **A crew has no hours-per-day number.**  The schedule board wants to warn about an over-booked day.
  Nothing in the schema holds crew capacity.
- **Expiration means two different things.**  `project_document.can_expire` and `expire_days` read like
  a price that expires.  The note in the design doc says the behavior should be "hide from reports after
  this many days".  The customer proposal page makes a promise either way.
- **There is no permission for clocking a crew in and out.**  The foreman screen needs one.  The
  `permission` table has ten codes and none of them fit.
- **`project_line_item.estimated_hours` is a whole number.**  Estimators think in half days.
- **Lead source is free text.**  `project.lead_source` is a varchar, but reporting wants a fixed list.
- **Save behavior is not settled.**  Some mockups edit in place, some have a save button.  Pick one and
  apply it everywhere.

## What is not designed yet

- Photo markup.  Every photo is a gray box.
- Email and text messages to clients.
- Taking payment online.
- Reporting past the summary bar on the project list.
