# ArboStar import notes

What `import_arbostar_export.ts` (run via `scripts/import_arbostar_export.ts --company_id <id>`)
does and doesn't carry over. The big picture: ArboStar models a lead, its estimates, its work
orders, and its invoices as separate records; this schema models the whole pipeline as **one
project moving between project documents**. So one project is created per ArboStar lead, the
related records pick its document stage, and anything without a home is summarized into
`project.lead_details` text.

## Mapping decisions

| Decision | Rule |
| --- | --- |
| Project document stage | lead has a work order or invoice → **Work Order**; else lead status is No Go → **Void**; else lead has an estimate → **Estimate**; else lead status is New/Draft → **Lead (Unqualified)**; else → **Lead (Qualified)** |
| `project.closed` | any work order whose status name is `Finished` (matched by name — row-level `wo_status_id`s don't line up with the readme's status-tab table), or the lead has any invoice (invoicing means the work happened — whether it's *paid* is the billing system's concern, tracked as `payment` rows). One-way on re-imports: the import can close a project but never reopens one closed in-app |
| `sent_for_client_approval` | any estimate with email delivery tracking (`email_status` non-null — statuses alone undercount, since sent-then-resolved estimates move on to Confirmed/Declined/Expired), or with status 2 (Sent for approval) / 3 (Pending approval) for the few sent without email tracking |
| `needs_client_approval` | project landed on the Estimate document |
| Users → employees | only **active** (`active_status = 'yes'`) ArboStar accounts become `employee` rows — suspended/inactive ones are ignored entirely, on first import and re-imports, so their estimator names survive only as lead_details text. An uncorrelated user whose login/emails match an existing employee's `login_name`/`email` (or, failing that, whose name matches, normalized) adopts that row instead of inserting — this is how the account a person created in-app before the first import becomes their ArboStar-linked row. `is_owner` is an in-app permission: inserted as false, never updated |
| Employee identity | ArboStar's login username (`emailid`) → `employee.login_name`; its `personal_email` → `employee.email` (empty string → null; a user with neither gets a synthesized `arbostar.user.{id}@company.{company_id}.import.invalid` email, since at least one is required). Both columns are unique across the **whole employee table**, so inserts are checked against every existing identity up front — a collision downgrades the identity (login_name nulled / email replaced with the placeholder) instead of failing. Identity columns are **insert-only**: re-imports never overwrite email/login_name, since they're login credentials |
| Employee passwords | imported employees get an empty `password_hash`, which can never match a computed hash — they **cannot log in** until someone sets a real password |
| Estimator | matched to an employee by normalized name (existing employees plus the imported users); unmatched names (e.g. ArboStar's "system system") are kept as an `Estimator:` line in `lead_details` |
| Primary contact | ArboStar doesn't flag one, so each client's first contact gets `is_primary`. Verified well-founded: the client-row-level `cc_name`/`cc_phone`/`cc_email` columns exactly equal `contacts[0]`'s in all 1,463 clients of the July 2026 export, even for the 4 clients whose contacts arrays aren't `cc_id`-ordered — so first-is-primary mirrors ArboStar's own display order rather than being a guess |
| Primary address | taken from the client row's own address columns (the only address source — ArboStar's profile-only "secondary address" has never had data and is not exported); `client.primary_client_address_id` is fixed up after the address rows insert, per the schema's convention |
| Payments | each ArboStar payment record (payments.js — real amounts and methods, not invoice-derived) becomes one `payment`, and ArboStar's own allocations (payment → estimate applications with real split amounts) become its `payment_project` rows — resolved to projects via each estimate's lead, collapsed to one row per (payment, project), reconciled (update/insert/delete) on re-import. Payment methods are natural-keyed by name per company like item types: the server-resolved labels (`pay_method_string` — Cash / Credit Card / Cheque…) are created on first use and reused after; no method recorded → `Unknown`. Payments that vanish from the export are counted, not deleted — usually an ArboStar-side deletion/refund worth a manual look |
| Project totals | `subtotal` / `tax_total` / `total`: from the lead's invoices when any exist (Σ `total_for_services` / Σ `tax` / Σ `total_including_tax` — the real discounts and tax); otherwise subtotal = the **non-declined line sum** (ArboStar's own current-state math — its work order `total_price` equals exactly that, while estimate `total_price` is a stale snapshot that usually still counts declined lines), tax_total = 0 (only invoices carry tax), total = subtotal. A lead with no line items has no quote yet — all three null |
| Item types | one `item_type` per distinct line-item `service_name`; `taxable` from the first line item seen with that name |
| Client type | ArboStar's numeric `client_type` code becomes a label in `client.notes` (1 → Residential, 2 → Commercial; unknown codes kept raw). Notes-only for now — worth an explicit schema column eventually |

## ArboStar values that were NOT imported

“→ lead_details” means the value survives only as text on the project, not as structured data.

### clients.js

| Field | Fate |
| --- | --- |
| `client_id` | used to link during import, then **discarded** — see “no ArboStar ids” below |
| `client_brand_id` | dropped |
| `client_date_created` | → `client.notes` as a `Created in ArboStar: YYYY-MM-DD` line (`created_at` itself becomes the import time) |
| `client_integration_id` | dropped |
| `client_main_intersection` | dropped |
| `address_related` (country / lat / lon / place_id) | dropped (no geocoding columns) |
| nested `contacts[]` | → `client_contact` rows; per contact, `cc_title` → `description` (boilerplate `Contact #N` / `Primary Contact` titles filtered to empty), `cc_name` → `name`, `cc_phone`/`cc_email` → columns, and `cc_email_check` / `cc_email_manual_approve` / `cc_email_blocked` / `cc_email_blocked_reason` / `cc_email_blocked_date` / `cc_email_unsubscribed` / `email_unsubscribe` → captured in the `arbostar_email_data` JSON snapshot (keys are the field names minus the `cc_` prefix). `cc_id` → `arbostar_contact_id` (the correlation key, also the fallback contact name). Dropped: `cc_print` and the phone derivatives `cc_phone_ngrams` / `cc_phone_int` / `cc_phone_clean` |
| any other raw columns | clients.js is now the raw datatable row — everything not listed in the typed fields of `clients.d.ts` is untouched by the import |

### users.js

The `employee` table only holds name, email, phone, and login fields, so most user data has
nowhere to go.

| Field | Fate |
| --- | --- |
| `emp_position` | dropped (no title/position column) |
| `emp_yearly_rate` / `emp_hourly_rate` | dropped (pay lives on `work_skill.hourly_rate`, which isn't per-employee) |
| `active_status` | drives the import filter — only `'yes'` accounts import, everything else is ignored |
| `active_employee` | dropped |
| `user_type` (admin/user) | dropped (not mapped to `is_owner` or software roles; imported employees get `is_owner = 0`) |
| `worker_type` (field/office) | dropped |
| `emp_date_hire` / `emp_date_fired` | dropped |
| `emp_birthday` / `emp_sex` | dropped |
| `address1` / `address2` / `city` / `state` / `user_zip` / `user_country` / lat/lng | dropped |
| `color` | dropped (`crew.color` exists, but crews aren't imported) |
| `user_email` (ArboStar login/notification email) | used (alongside `emailid` and `personal_email`) to match pre-existing in-app employees by identity, but not stored — `personal_email` maps to `employee.email` instead |
| `extention_key` | dropped |
| `internal_employee_id` / `emp_custom_id` | dropped |

### leads.js

| Field | Fate |
| --- | --- |
| `lead_no` | integer parsed out (`123-L` → 123) → `project.number` (the user-facing project number and the re-import correlation key); the full string also survives in lead_details. `project_number.last_number` is bumped past the max imported number |
| `lead_status_id` / `lead_status_name` | picks the document stage; name → lead_details |
| `lead_reason_status_id` | dropped (No Go reason codes) |
| `lead_priority` | → lead_details (schema only has an `emergency` bit, which is not inferred) |
| `lead_date_created` / `lead_created_by` | → lead_details (`created_by_employee_id` is the importing company's owner) |
| `lead_assigned_date` / `lead_postpone_date` | dropped |
| `estimator` | → `assigned_estimator_employee_id` on a name match, else lead_details |
| `lead_address` / `address_line_display` | → lead_details (the project's address columns copy the client's primary address so they agree with `client_address_id`) |
| `utm_medium` / `utm_campaign` / `utm_term` / `utm_content` / `utm_referral` / `gclid` / `form_id` | dropped (`utm_source` → `lead_source`) |

### estimates.js (no estimate entity exists — one line each in lead_details)

| Field | Fate |
| --- | --- |
| `estimate_no`, `status_name`, `total_price` | → lead_details line |
| `status_id` | picks document stage / `sent_for_client_approval`, then dropped |
| `total_price` | **not stored** — a stale snapshot that usually still counts declined lines; `project.subtotal` uses the non-declined line sum instead |
| `email_status` | non-null drives `sent_for_client_approval`, then dropped |
| `date_created`, `email_created_at` | dropped |

### workorders.js (no work-order entity — document stage + lead_details)

| Field | Fate |
| --- | --- |
| `workorder_no`, `status`, `total_price` | → lead_details line; `status` also drives `closed` when `Finished`. `total_price` itself is not stored — it equals the non-declined line sum that `project.subtotal` is computed from (pre-tax) |
| `wo_status_id` | dropped — row-level ids don't match the status-tab ids (finished rows carry 0, not the tab table's 7), so the status *name* is the reliable signal |
| `office_notes` | → `notes_for_office` |
| `latest_status_update` | dropped (would have been the only source for `closed_at`/`closed_date`, but its format isn't trustworthy) |
| `total_done` / `total_completed_not_invoiced` / `total_invoiced` / `total_scheduled` / `total_unscheduled` | dropped |
| `man_hours_*` (total/done/invoiced/scheduled/unscheduled) | dropped |

### invoices.js (no invoice entity — lead_details only)

| Field | Fate |
| --- | --- |
| `invoice_no`, `total_including_tax`, `amount_paid` | → lead_details line (payments themselves come from payments.js) |
| `invoice_notes` | → `notes_for_office` |
| `date_created` | dropped |
| `total_for_services` | → summed into `project.subtotal` (it is already discount-adjusted); `total_including_tax` also → summed into `project.total` |
| `discount` / `deposit_amount` | dropped (`total_for_services` already reflects the discount) |
| `tax` | → summed into `project.tax_total`; also implies the project's rate: Σ `tax` / the taxable non-declined line sum (what ArboStar applied the rate to — falls back to Σ `total_including_tax` − Σ `tax` when the lead's lines are missing), snapped to the nearest entry in the official tax list (taxes.js). Any charged tax sets `taxable`, snapping among the *nonzero* official rates (partially non-taxable invoices blend the implied rate down, and a taxed invoice can't be on a 0% rate) and get-or-creating a `tax_rate` row (named "Tax (5.5%)"-style since ArboStar reuses bare names across rates; storing the ratio, 0.0550); no tax leaves the project not taxable |
| `total_due` | dropped — deliberately kept out of `closed`, which means "no more work to do", not "paid" |
| `interest_status`, `client_phone` | dropped |

### payments.js

| Field | Fate |
| --- | --- |
| `payment_amount` | → `payment.amount` |
| `pay_method_string` | → `payment.payment_method_id`, creating the company's `payment_method` row on first use |
| `allocations[]` (amount, estimate → lead) | → `payment_project` rows (one per payment × project, amounts summed); allocations whose lead has no project are dropped, counted as `skipped_allocations_without_project` |
| `payment_date` | → `payment.pay_date`, converted from the UTC timestamp to the tenant's local (America/Chicago) calendar date (`payment.created_at` is still the import time) |
| `payment_fee` / `payment_fee_percent` | dropped (merchant expense, charged on top of the amount) |
| `payment_tips` / `unapplied_amount` | dropped |
| `payment_type`, `payment_notes`, `payment_author`, `payment_method_int` | dropped |

### line_items.js

| Field | Fate |
| --- | --- |
| `size` / `species` / `reason` | → appended to `description` as text |
| `man_hours` | → `estimated_hours`, **rounded to whole hours** (the column is an integer) |
| `cost` | dropped (no cost column — margin data is lost) |
| `optional` | → `client_optional` (forced true on Declined lines — this schema only allows declining optional lines, and a declined line was never billed regardless of how it was offered) |
| `status` | `Declined` → `client_declined`; otherwise dropped (`New` = still-undecided proposal, `Completed` = accepted/invoiced work — both import as not-declined) |
| `is_fee` / `is_additional_work` | dropped |
| `crews` | dropped (no crews are imported) |
| `sort_order` | dropped (table has no sort column) |
| `estimate_id` / `invoice_id` | dropped — every line attaches to the lead's single project, so which estimate/invoice a line belonged to is lost |

## Important current-schema columns that could NOT be populated

| Table.column | Why |
| --- | --- |
| *(all tables)* `created_at` / `updated_at` | set to import time; ArboStar's original timestamps are string-formatted and were left unparsed |
| `client.tax_rate_id` | ArboStar exports no tax rates |
| `client.billing_client_address_id` | no billing-address concept in the export |
| `client.referred_by` | lead-level `utm_*` data doesn't identify a referrer per client |
| `client_address.contact` / `.phone` / `.email` | no per-address contact info in the export |
| `employee.password_hash` | intentionally unusable — imported employees can't log in until given a real password |
| `project.due_date` | no schedule dates in the export subset |
| `project.emergency` | not inferable from `lead_priority` values |
| `project.notes_for_crew` | work orders only carry office notes |
| `project.closed_at` / `project.closed_date` | `closed` is set, but no reliable close date exists (see `latest_status_update` above) |

Whole tables that get nothing: `crew` / `crew_member`, `work_skill` /
`project_work_skill`, `time_entry`, `estimate_availability`,
`project_client_approval`, `project_document` (global codebook), `project_line_item_image`.

## Re-runnable: ArboStar ids are stored as correlations

Every imported row carries its ArboStar identity (migration 0016): `employee.arbostar_user_id`,
`client.arbostar_client_id`, `payment.arbostar_payment_id`, `client_contact.arbostar_contact_id`,
`project_line_item.arbostar_line_item_id`, and `project.number` (the parsed `lead_no` integer).
The import is **idempotent**: re-running updates the ArboStar-derived columns of existing rows
and inserts only what's new (see `claude_rerunnable_import_notes.md` for the design). Each
entity phase runs in its own transaction; a crash between phases is recovered by re-running.
Line items that disappear from the export are deleted, but only within projects present in the
current run — so a lead missing from a (possibly partial) export keeps its lines just like it
keeps its project. Contacts are never deleted (decided July 2026: too dangerous against partial
exports; ArboStar-side contact deletions will be reconciled deliberately if ever needed). Rows
with a null arbostar id — created in-app — are never touched, and top-level entities that
disappear just linger. All of the above surface as `*_no_longer_in_export` counts in the summary.

## Export-type gotchas found during verification

ArboStar's estimate editor payload **reuses a handful of line-item ids**: the June 2026 export
has 13 `line_item_id`s appearing twice — one real row and one phantom (null
service/price/quantity) on an unrelated newer lead. The import keeps whichever copy carries
the most data (`duplicate_line_items_dropped` in the summary).

`leads.estimator` and `workorders.estimator` are typed `string | null | []`: ArboStar returns
a literal empty array instead of null for a few records with no estimator (30 leads, 2 work
orders in the June 2026 export — PHP's empty-array serialization artifact; on the raw leads
endpoint it's `estimator.full_name` that is `[]`). `string_or_null` in `import_common.ts`
collapses the `[]` to null during import.
