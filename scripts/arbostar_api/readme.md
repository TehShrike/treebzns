# ArboStar API export

These scripts export data through ArboStar's documented REST API. They are meant to replace the website scrapers in `../arbostar/`. The API needs no browser session and has no editor pages that write on load.

```sh
pnpm run arbostar:api_export                                           # every dataset
pnpm exec dotenv -- node scripts/arbostar_api/export_all.ts leads users # only these
```

Output goes to `arbostar_api_export/<name>.js` (gitignored, client PII). The committed `arbostar_api_export/<name>.d.ts` files type each one.

## Auth

`.env` needs two values:

- `ARBOSTAR_BASE_URL`: the account origin, e.g. `https://your-account.arbostar.com`
- `ARBOSTAR_API_ACCESS_TOKEN`: sent as `Authorization: Bearer <token>`

The token does not expire every few days the way the session cookie does. `/api/v1/company-snapshot` answers 401 with this token. Nothing else does.

The docs live at `<base url>/docs/api` (behind the web login). They are generated from the Laravel validation rules, so most response shapes are empty.

## How the API behaves

- **Paging is `offset` + `limit`.** List responses carry `total_rows` (clients, estimates, invoices, payments, items, requests), `total` (leads, workorders), or `meta.total` (trackers, schedule events). The export asserts that it got exactly `total` distinct ids.
- **Page size caps:** 1000 for most lists, 100 for leads, workorders, and schedule events. `/api/v1/trackers` ignores `limit` and always returns 10 rows per page.
- **Parameters can go in the query string for any method.** Laravel merges the query string and the body into one input, so a GET with a JSON body works, and so does a POST with only a query string. The docs show GET parameters as a "request body" only because the doc generator reads them from the validation rules.
- **Why some lists are POST:** `/api/tasks`, `/api/schedule/event`, and `/api/payroll/employee` are registered only as POST routes. GET answers 404. They are the older, unversioned `/api/*` routes. Every `/api/v1/*` list is GET. There is no functional reason for the POST. It is a route-definition choice.
- **Leads need `include_relations[]`.** Without `include_relations[]=estimate`, every lead's `estimate_id` comes back as `{}`. The export requests every relation.
- **Estimates have no `lead_id`.** Join through `leads.estimate_id`, or match numbers: estimate `01422-E` belongs to lead `01422-L`. The numbers matched on all 2074 estimates in the September 2026 site export.
- **Invoice pages are slow.** Each invoice nests its payments. Each payment nests every allocation, and each allocation nests a full estimate and invoice with line items. Payment 149 is split across 127 invoices. So each of those 127 invoices is about 300 KB and takes several seconds. A 25-row page took 96 seconds. The export pages invoices 10 at a time.

## What the export changes

The rows are the raw API rows except for three nested copies that repeat data from another file:

- `estimates[].client` is the full raw client table row. The export replaces it with `client_id` and writes the distinct rows to `client_records.js`. Only clients with an estimate have one.
- `invoices[].payments` becomes `payment_ids`. `payments.js` has the full payments.
- `payments[].projects[].estimate` and `.invoice` become `{ id, number }`.

## Files

| File | Endpoint | Notes |
| --- | --- | --- |
| `clients.js` | `GET /api/v1/clients` | Thin row with every contact |
| `client_records.js` | nested in estimates | Raw client row: email flags, secondary address, tax, and the primary contact only |
| `leads.js` | `GET /api/v1/leads` | Lead source is `reference.name` |
| `estimates.js` | `GET /api/v1/estimates` | `items` holds every line item, including the children of service groups |
| `invoices.js` | `GET /api/v1/invoices` | Line items, totals, and the estimate, work order, and lead |
| `payments.js` | `GET /api/v1/payments` | `projects` are the allocations |
| `workorders.js` | `GET /api/v1/workorders` | `crew_names` are crew role codes |
| `users.js` | `GET /api/v1/trackers` | Includes `employee_worked` time entries |
| `items.js`, `categories.js` | `GET /api/v1/items`, `/api/v1/categories` | Service catalog |
| `brands.js` | `GET /api/brands` | Company name, phone, and address |
| `requests.js` | `GET /api/v1/requests` | Web form requests |
| `schedule_events.js` | `POST /api/schedule/event` | Crew schedule. `services[].id` is the line item id. `jobs` is the field report. |
| `tasks.js`, `task_categories.js` | `POST /api/tasks`, `GET /api/tasks/categories` | Estimator calendar. The API nests tasks by day and user. The export flattens them. |

Not exported: `/api/v1/classes` (empty), `/api/v1/i18n`, `/api/payroll/employee`, `/api/programmed-messages/*`, and the write endpoints.

## Coverage of what the importer reads

Compared with the fields `src/shared/arbostar/import_*.ts` reads from `arbostar_export/`, checked September 2026. Every record id in the site export is also in the API except one lead and one work order that were deleted after the site export ran.

| Site export | API coverage | Missing from the API |
| --- | --- | --- |
| clients | Full | Email-status flags for contacts other than the primary contact |
| invoices | Full | |
| estimates | Almost | `email_status` (sent to the client), office notes |
| workorders | Almost | `latest_status_update` (the finish date). Office notes appear only on the invoice's `workorder` object. |
| payments | Almost | Tips, merchant fee, and the recording user. Tips can be derived as `amount` minus the allocations. |
| users | Almost | `personal_email`, `emp_phone` |
| leads | Partial | `lead_priority`, `lead_created_by`, the creation time (only the day is present) |
| lead_notes | Partial | The lead description (`lead_body`) and estimate office notes. Crew notes and the lead source details are present. |
| line_items | Partial | Crew roles, man-hours, `optional`, size/species/reason, and the sort order |
| taxes | Partial | No tax list. Each estimate and invoice carries its tax name and rate. |
| declines | None | |
| crew_roles | None | Schedule events and work orders carry the crew code only, with no role name or rate |
| tree inventory | None | The markers service does not need the website session. Only the set details do. |

## Schema columns that change if an entity switches to the API

These are the columns that the importer (`src/shared/arbostar/import_*.ts`) writes, where the value would change if its input came from the API instead of the site export. Columns that get the same data from both sources are left out. Counts come from the Sep 12 2026 site export and the Sep 29 2026 API export.

"Lose" means the API has no source for the value. "Gain" means the API has data that the site export does not. "Worse" and "Better" mean that both sources have a value, but one is less exact.

| Column | Effect | Details |
| --- | --- | --- |
| `project.lead_details` | Lose | From the lead description (`lead_body`). 1558 leads have one. |
| `project.notes_for_office` | Lose (part) | Estimate office notes (395 leads). Work order office notes for the 29 work orders without an invoice. The ArboStar summary also loses the lead priority, the creation time, the name of the user who created the lead, and the decline reason. |
| `project.sent_for_client_approval` | Lose (part) | The site export marks an estimate as sent when it has email tracking (`email_status`). The API has only the status. 1085 estimates count as sent only because of email tracking. |
| `project.project_decline_reason_id` | Lose | Decline reasons come from the Decline Reasons report (399 declines). |
| `project.closed_at`, `project.closed_date` | Lose (part) | Declined projects lose their close time. For finished work orders, the API has `updated_at` in place of `latest_status_update`. The local day matches on 693 of 929. |
| `project.assigned_estimator_employee_id` | Better | The API gives the estimator's user id. The site export gives only a name, which the importer matches to an employee. |
| `project.taxable`, `project.tax_rate_id`, `project.tax_rate` | Better, Gain | Each invoice and estimate carries its tax name and rate. The importer now infers the rate from tax amounts and snaps it to the closest official rate. 361 taxed estimates have no invoice. Today those projects import as not taxable. |
| `project.taxable_subtotal` | Better | The API gives `totals.sum_taxable` for each invoice. The importer now derives it. |
| `project.latitude`, `project.longitude` | Gain | Every API lead has coordinates. The importer sets neither column today. |
| `project.lead_source_id` | Gain (small) | The API has `lead_source_details` on every lead. The site export has it only on leads with an estimate. This affects 1 "Other" lead today. |
| `project_document_history.change_datetime` | Worse | The first row uses the lead creation time. The API gives only the day, so 2121 leads would move to local midnight. The Declined Proposal row loses its decline time. |
| `project_line_item.estimated_hours` | Lose | From `man_hours`. 1857 of 4643 line items have a value. |
| `project_line_item.client_optional` | Lose (part) | From `optional`. 2081 line items are optional. Declined line items still set it, because the API has the status. |
| `project_line_item.sort`, `invoice_line_item.sort` | Lose | The API has no sort order. The array order may be the display order, but this is not verified. |
| `project_line_item.done_at` | Gain (maybe) | 119 line items have a `date`, and 1773 have the status Completed. It is not verified that `date` is the completion day. The importer sets neither column today. |
| `project_line_item_work_skill` (all columns) | Lose | From each line item's `crews` codes (2242 line items). The API has crew codes only on work orders (`crew_names`) and on schedule events. |
| `work_skill.name`, `work_skill.hourly_rate` | Lose | From the Crew Roles page. The API has no role names or rates. |
| `invoice.tax_rate_id`, `invoice.tax_rate`, `invoice.taxable_subtotal` | Better | The API gives each invoice's rate and taxable sum. The importer now derives both. |
| `invoice.due_date` | Better | The API gives the due date. The importer now computes it from `company.invoice_due_after_days`. It differs on 1 of 1006 invoices. |
| `payment.merchant_fee` | Lose | 794 of 1317 payments have a fee. |
| `payment.recorded_by_employee_id` | Lose | 567 payments name the user who recorded them. |
| `payment.tip`, `payment.amount` | Worse | The API `amount` includes tips (the same as `payment_amount`), and the API has no tip field. Tips can be derived as `amount` minus the allocations when the difference is positive. 62 payments have tips. |
| `client_contact.arbostar_email_data` | Lose (part) | The API has email flags only for the primary contact, and only for clients with an estimate (through `client_records.js`). 25 other contacts have flags. 176 clients have a flagged primary contact but no estimate. |
| `client_contact.phone`, `client.billing_phone` | Worse | The importer uses the formatted `cc_phone_view`, for example `(402) 850-3778`. The API gives only the digits for most contacts. We can format them ourselves. |
| `employee.email` | Lose | New employees get `personal_email`. 4 of 5 active users have one. The API has only the login email (`user_email`). |
| `employee.phone` | Lose | From `emp_phone` (5 of 5 active users). |
| `tax_rate` (all columns) | Worse | The site export has the official tax list. The API gives only the rates used on estimates and invoices. Today that is only "Tax" at 0% and 5.5%. |
| `item_type.taxable` | Better | The API gives the catalog item's `non_taxable` flag. The importer now copies it from the first line item that uses the item. |

Tables the importer does not fill today could also get API data. `crew`, `project_crew`, `project_crew_employee`, and `project_crew_project_line_item` could come from schedule events. Each event has a crew, the scheduled line item ids, and times. `clock_session` and its related tables could come from each event's field report (`jobs`) and from users' `employee_worked` time entries (3 rows so far). `company.name` could come from `brands.js`.
