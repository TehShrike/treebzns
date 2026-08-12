# ArboStar data export

One-off scripts to pull data out of ArboStar
into JSON. ArboStar has no bulk/export API and no
single "give me everything" endpoint — the list screens are each backed by their own
[jQuery DataTables](https://datatables.net/manual/server-side) endpoint (paged through), and
line items only exist behind per-record detail endpoints (fetched one by one).

## Files

| File | What it is |
| --- | --- |
| `fetch_datatable.ts` | Generic DataTables fetcher (pagination + the status-union logic below). Engine behind the list exports. |
| `fetch_record.ts` | Single-record JSON GET + a concurrency-limited mapper. Engine behind the per-record exports (line items). |
| `fetch_clients.ts` | Thin typed wrapper over the generic fetcher, pinned to `/clients`. |
| `.arbostar_session.json` | **Credentials + account base URL. Gitignored — never committed.** Copy `.arbostar_session.example.json` to it and fill in. |
| `session.ts` | Loads `.arbostar_session.json` and exposes `BASE_URL` / `AUTH_HEADERS` / `BROWSER_COOKIES`. |
| `output.ts` | Reads/writes the `arbostar_export/` dir at the repo root — writes each dataset as `<name>.js` (`export default [...]`, gitignored). |
| `export_*.ts` | One run-now script per dataset. |
| `discover_endpoints.ts` / `discover_details.ts` | Puppeteer crawlers that record the app's XHRs (list pages / detail pages). `discover_endpoints.ts` regenerates `arbostar_endpoints.json`. |
| `arbostar_endpoints.json` | Map of all ~36 list/XHR endpoints, with an example `path_and_query` for each. |

## Running an export

```sh
node scripts/arbostar/export_clients.ts      # -> clients.js (raw rows; contacts + address_related nested)
node scripts/arbostar/export_workorders.ts   # -> workorders.js
node scripts/arbostar/export_leads.ts        # -> leads.js
node scripts/arbostar/export_estimates.ts    # -> estimates.js   (two passes)
node scripts/arbostar/export_invoices.ts     # -> invoices.js
node scripts/arbostar/export_line_items.ts   # -> line_items.js  (reads estimates.js; ~1684 × 355 KB — slowest)
node scripts/arbostar/export_payments.ts     # -> payments.js    (BI Client Payments report; see the payments section)
node scripts/arbostar/export_users.ts        # -> users.js       (user accounts; see the Users section)
node scripts/arbostar/export_taxes.ts        # -> taxes.js       (official tax list, scraped from /settings)
node scripts/arbostar/export_declines.ts     # -> declines.js    (decline reasons; see the Decline reasons section)
node scripts/arbostar/export_work_types.ts   # -> crew_roles.js + work_types.js  (reads estimates.js; see the labor catalogs section)
```

Each dataset is written to `arbostar_export/<name>.js` as an ESM `export default [...]` (gitignored;
the committed `arbostar_export/<name>.d.ts` types it). `export_line_items.ts` reads
`estimates.js`, so run that first. See
[`arbostar_export/readme.md`](../../arbostar_export/readme.md) for the output side.

Approximate volumes (June–August 2026): clients 1435, leads 1850, workorders 836,
estimates 1684, invoices 906, line items 3592, payments 1204, users 6. "Projects" in
ArboStar are **Work Orders** (`/workorders`).

## Auth / refreshing the session

Credentials and the account base URL live **only** in `scripts/arbostar/.arbostar_session.json`,
which is gitignored and must never be committed. To set up: copy `.arbostar_session.example.json`
to `.arbostar_session.json`. To refresh: open the app logged-in, DevTools → Network → click any
datatable request (e.g. to `/clients`) → Copy as cURL, then fill in:

- `base_url` — your account origin, e.g. `https://your-account.arbostar.com`
- `headers.cookie` (only `XSRF-TOKEN` and `[identifier]_session` actually matter)
- `headers.x-csrf-token` (same value as the XSRF-TOKEN cookie), `x-device-id`, `x-fingerprint`
- `cookies` — the same `XSRF-TOKEN` + `[identifier]_session` as `{name,value,domain,path}` objects,
  used by the puppeteer discovery scripts (which set browser cookies rather than headers)

The `[identifier]_session` cookie expires every couple of days. **Symptom of a stale
session: the export throws `request failed: 302`** (a redirect to the login page).

## How the endpoints work (the non-obvious bits)

All module endpoints (`/clients`, `/leads`, `/estimates`, `/invoices`, `/workorders`) speak
the same DataTables protocol over `GET`:

- **Rows are nested under `data.original`**, not the top level. The grand total is
  `recordsTotal` at the top level. (A few endpoints return `data` as a bare array; the
  fetcher handles both.)
- **Pagination** is `start` (offset) + `length` (page size), with a `draw` counter that just
  echoes back. We page at 200.
- **You must declare the column you order by.** The server reads `order[0][column]=N` and then
  looks up `columns[N][name]` for the DB column. If column `N` isn't declared you get a
  **500** — this is why a "minimal" request with just `start`/`length` fails for most modules
  even though it happens to work for `/clients`. The fetcher always emits one
  `columns[N][...]` block matching the order column.
- **Required headers:** `x-requested-with: XMLHttpRequest` and `x-request-type: datatable`.
  Without them you get HTML, not JSON.
- Responses also carry a `statuses` array (the status-tab definitions) — that's where the
  status-number meanings below come from.

### The status-filter gotcha (why estimates/invoices/leads need two passes)

Each list is scoped by a **status tab**, passed as repeated `status_ids[]` params. There's a
`-1` "All" sentinel — **but what `-1` actually returns is inconsistent per module**, and the
on-screen default view is almost never the full dataset:

| Module | `status_ids[]=-1` returns | Full dataset needs |
| --- | --- | --- |
| `/workorders` | full history (836) ✅ | `-1` is enough |
| `/estimates` | full history incl. declined (1684) ✅ | `-1` is enough |
| `/leads` | only **active** leads (~4) ❌ | every status id (most leads become "Estimated" and leave the view) → 1850 |
| `/invoices` | only **"All outstanding"** (27) ❌ — excludes Paid | every status id → 826 |

Because no single filter is reliable, `fetch_all_rows_every_status()` does **both**: it fetches
`status_ids[]=-1`, then fetches with **every** status id enumerated from the `statuses` array,
and **unions the two by primary key**. That yields the maximum for every module without having
to special-case each one. (Passing unknown ids — the string `overpaid`, the negative `-4` for
Declined — is harmless; the server ignores them, and those rows are already covered by the
other pass.)

## Line items (per-record detail endpoint)

These don't exist on the list endpoints — each is a single-record JSON GET, fetched one per
record via `fetch_record.ts`.

**Line items** — `GET /estimates/edit/{LEAD_id}`, rows at `lead.estimate.estimates_service`:

- **Keyed by lead id, NOT estimate id.** `/estimates/edit/1696` loads the estimate for *lead*
  1696, which is a different estimate than the one whose DB `estimate_id` is 1696. Use the
  `lead_id` from `estimates.js` (it's 1:1 with estimates here). The returned line items'
  `estimate_id` then matches the list's `estimate_id`.
- It's the **estimate editor**, so the payload is ~355 KB — it re-sends the whole service
  catalog (`tree_types` alone is ~694 entries) on every call. There is no lighter endpoint and
  no per-estimate route (all the `/estimates/get*`/`/estimates/services/{id}` guesses 404).
- **One source covers everything.** Each `estimates_service` row carries `estimate_id`,
  `invoice_id`, and `parent_invoice_id`. When an estimate is invoiced those rows get an
  `invoice_id`; work orders schedule the same rows. So invoices and work orders have **no
  separate line-item JSON endpoint** (the invoice editor renders them into HTML) — filter
  `line_items.js` by `invoice_id` instead.
- Line totals won't sum to the estimate total: `optional` lines and discounts are applied on top.

## Labor catalogs: crews + work types (from the estimate editor)

The two labor catalogs have no endpoint of their own. The estimate editor payload
(`GET /estimates/edit/{lead_id}`) re-sends both on every call, so `export_work_types.ts`
makes one editor fetch (for the first lead id in `estimates.js`) and writes both files:

- **`crews`** → `crew_roles.js` — what the UI calls **Crew Roles** (managed at `/employees/crews`,
  columns: Crew Name = the code, Crew Role = the full name, Cost Per Hour = `crew_rate`).
  August 2026: CL0–CL3 (Arborist Climber, $70–$200/hr), BM1/BM2 (Bucket Truck Operator, $80),
  GM (Groundsman, $130), STU (Stump Grinder Operator, $170), TEC (Technician, $300), ISA
  (ISA Arborist, $120), AC1/AC2 (Consulting Arborist, $100/$120), REP (Repair, $65).
- **`work_types`** → `work_types.js` — the pruning work types (`ip_*` fields): Clean canopy,
  Crown reduction, Deadwood, Remove, and 13 more.

How they map to jobs:

- **Line item → crew roles** is already exported: each row in `line_items.js` carries a
  comma-joined `crews` string (e.g. `'CL3, GM'`) whose codes match `crew_roles.js` `crew_name`.
  In the raw editor payload the same link is the per-line `crew[]` array, whose `pivot`
  rows (`crew_service_id` = line item id, `crew_user_id` = crew_id) are the join table.
  Since line items carry `estimate_id` and `invoice_id`, this one string covers the
  estimate → skills and work-order → skills mapping.
- **Work types attach to tree inventory entries** (`/treeInventory/indexData/{lead_id}`),
  not to line items. No lead checked so far has inventory entries, so nothing references
  `work_types.js` yet.
- The estimate entity also has per-role requirement flags (`climber`, `groundsmen`,
  `bucket_truck_operator`, ...), each `'yes'`/`'no'` — a coarser signal than the line-item
  `crews` string.

## Payments (`/business_intelligence/clientPaymentsDatatable`)

Every payment in the account comes from one paged datatable: the Business Intelligence →
Client Payments report (`POST /business_intelligence/clientPaymentsDatatable`). This replaced
the old approach of one `POST /clients/profile/getClientPayments` per client (~1435 requests).
Rows are the **full raw payment records**, richer than the per-client endpoint: the same
`payment_projects` allocation rows (per-allocation amounts, each embedding its estimate's
`lead_id`), plus the full `payment_method` record, `payment_transaction` (gateway details),
`users` (the recording user), and QB sync fields.

The endpoint speaks its own datatable dialect — the generic `fetch_datatable.ts` does not fit:

- **POST** with a form body, not GET query params.
- Rows come back under `items`, not `data.original`.
- **Sorting is by column name**: `order[0][column]=payment_date` + `order[0][direction]=ASC`.
  The standard numeric DataTables order/columns params **500** (`Undefined index: direction`).
  Valid sort names are the report's column names (`payment_date`, `payment_amount`,
  `payment_method`, `payment_type`, `estimator`, `invoice_date`) — `payment_id` is not one.
  Omitting `order` entirely also works.
- **The report defaults to the current month.** Pass a wide range via
  `filters[payment_date_from]` / `filters[payment_date_to]` (`MM/DD/YYYY`) to get everything.
  Other filter keys (`filters[methods]`, `filters[estimator]`, `filters[sync_status]`) are
  optional.

Money-field semantics (why the export derives `unapplied_amount` the way it does):
`payment_amount` includes tips but allocations don't, and fees exist in two modes — when
`payment_fee_percent` > 0 the fee was charged on top (excluded from `payment_amount`), and
when it is 0 a nonzero `payment_fee` was deducted from `payment_amount` while allocations
stay gross. The row has no payment-level `unapplied_amount`, so the export computes
`payment_amount - tips + deducted_fee - allocations` (0 for every payment so far, matching
the per-client endpoint). There is also `/business_intelligence/clientPaymentsReportCSV`
(same filters, returns the report as CSV rows) — unused, the datatable rows carry more.

### How ArboStar relates payments to projects

The whole relation is the `payment_projects` table (`allocations` in payments.js) — one row
per (payment, estimate) application with a real split amount. A "project" there is the
**estimate** (1:1 with its lead), optionally pinned to the invoice that billed it. So
payments relate **directly** to estimates and invoices only; the export keeps it that way.
Every other relation is a join: allocation `estimate_id` → estimates.js for the `lead_id`,
`invoice_id` → invoices.js, and on to the work order from there. **There is no payment →
line-item relation anywhere** — the raw rows contain no service/line-item ids (verified
across all 1204 payments). Line items attach to the estimate/invoice separately, so money
can only be related to line items by joining through `estimate_id`/`invoice_id`. The
payment row also has its own `estimate_id`/`invoice_id` columns, but they are 0/null on
every payment in this account — the allocations carry the real links. The report's
`proj_values` blob (exported as each allocation's `report_values`) is its per-allocation
money breakdown: fee/tax attribution and the estimate's/invoice's pre-tax services totals.
Its money fields (and the row-level `amount`, `tax_amount`, `total_amount`) are computed
with floats server-side and served dirty (`1614.1499999999999`). The export passes them
through verbatim — nothing in payments.js is computed by our code. Consumers normalize the
noise with `#shared/arbostar/arbostar_number_to_fnum.ts` (the import's `money()` helper
already does). payments.d.ts tags every field as Original (raw table column) or Calculated
(by the report).

## Decline reasons (`/estimates/declines`)

Estimate decline reasons exist as data in exactly one place: the **Decline Reasons report**
(`GET /estimates/declines`, the settings-nav "Decline Reasons" page). The estimate list rows
don't carry them, and on the full estimate entity `estimate_reason_decline` is just the bare
id (one ~355 KB editor fetch per estimate). The report speaks the usual DataTables protocol
(same headers, `data.original` rows, declared order column) with one extra requirement: a
`from`/`to` date range (`MM/DD/YYYY`) — without the DataTables params the endpoint 500s with
PHP notices, which makes it look broken. `export_declines.ts` passes a wide range
(01/01/2015–12/31/2099) to get everything.

Each row carries `estimate_id`, `estimate_reason_decline` (id), `reason_name`, client info,
and `total_price` — so one paged fetch covers every declined estimate. The response also
carries `reason_status`: the tenant's full canned reason list as parallel `labels`/`data`
(counts) arrays, ordered so reason id N = `labels[N-1]`. The August 2026 list:

| id | reason |
| --- | --- |
| 1 | Price is too high |
| 2 | Unclear Estimate |
| 3 | Preferred the competition |
| 4 | Not interested in the job anymore |
| 5 | Unable to reach the client |
| 6 | Scheduling delays/conflicts |
| 7 | Client can't be pleased |
| 8 | Estimator didn't contact the client |
| 9 | Estimate doesn't provide the service client wanted |
| 10 | Customer service |
| 11 | Company reputation |
| 12 | No follow-up |
| 13 | Municipal tree |
| 14 | Declined Permit |
| 15 | Expired |

Rows embed `reason_name` directly, so consumers should match on the name rather than trust
this table's ordering. There is no work-order equivalent — ArboStar has no cancelled-work-order
concept (only line-item-level declined status, which line_items.js already carries).

**Client secondary addresses** — a client may have a secondary address
(`client_address2`/`client_city2`/`client_state2`/`client_zip2`) that only appears on the
client **profile** (`GET /clients/profile/indexData/{client_id}`, under `client`), not the
list. There used to be an `export_addresses.ts` that fetched every profile for these, but no
client in the account has ever had one, so it was removed — the raw list rows in `clients.js`
are the only address source now.

## Users (the non-DataTables module)

The Users screen (`/user/active`) is the one list that is **not** DataTables-backed, and none
of it shows up in `arbostar_endpoints.json` (the crawler never visited it). Found by reading
`/assets/js/config/routes.js` (which maps the `user` module) and
`/assets/js/modules/user/users.js` (which makes the calls):

- **List** — `POST /user/list_ajax` (form-encoded) with repeated `users_status_id[]` params.
  The sentinel `-1` = the "All" tab; the named tabs are `active` / `inactive` / `dismissed`
  (returned in the response's `statuses` array). Rows come back under `data`, but they're
  thin (id, names, login, position, phone, color, worker/user type — no email or rates).
- **Detail** — `GET /user/get/{user_id}` is an HTML page, but it embeds the full record as an
  inline `window.UserFormConfig = {...};` JSON blob (login email, personal email, rates, hire /
  fired dates, address, and also credential/MFA config plus `emp_sin`, which the export
  deliberately leaves out).
- `GET /user/getData` returns only the status counts/config for the screen, no rows.
  `/employees/*` and `/users*` route guesses all 404 — `user` (singular) is the module name.
- `user_type` is `admin`/`user`; `worker_type` `1` = field worker, `2` = office (the list's
  "field workers" filter matches `1`). `active_status` on the detail record is `yes` for
  active users (not `active`).

`export_users.ts` unions the `-1` pass with the named-status pass by id (same belt-and-braces
approach as the DataTables modules), then enriches each id from its detail page.

## Datatable vs. full-endpoint columns

The datatable endpoints return a **fixed projection**, not the whole record. Adding fields to
the `columns[]` params does **not** change what comes back (verified: requesting `client_email`
/`client_source`/`client_zip2` as columns left them absent) — `columns[]` only drives search and
ordering. So the datatable cannot fetch every column.

Neither source is a strict superset: the datatable adds **computed/joined** fields the raw record
lacks (rollup totals, the latest lead/estimate, the primary contact, geocoded `address_related`),
while the full entity has the bulk of the **raw** columns the datatable omits. `✓` = present,
`—` = absent. A `—` in the **Datatable** column is something you only get from the full endpoint.
(The clients/leads/estimates exports here deliberately ship a curated subset of these.)

Invoices and work orders have **no** full-entity JSON endpoint, so their datatable projection is all that is available as JSON.

### Clients

- Datatable: `GET /clients` — 40 columns
- Full entity: `GET /clients/profile/indexData/{client_id}` — 73 columns
- **54 columns are only on the full endpoint** (what you miss with the datatable alone)

| Column | Datatable | Full entity |
| --- | :---: | :---: |
| `address_line_display` | ✓ | ✓ |
| `address_related` | ✓ | ✓ |
| `all_taxes_with_client_tax` | — | ✓ |
| `brand` | — | ✓ |
| `cc_email` | ✓ | — |
| `cc_name` | ✓ | — |
| `cc_phone` | ✓ | — |
| `cc_phone_config_status` | ✓ | — |
| `cc_phone_masked` | ✓ | — |
| `client_address` | ✓ | ✓ |
| `client_address2` | ✓ | ✓ |
| `client_address_check` | — | ✓ |
| `client_autotax_name` | — | ✓ |
| `client_autotax_rate` | — | ✓ |
| `client_autotax_text` | — | ✓ |
| `client_autotax_value` | — | ✓ |
| `client_brand_id` | ✓ | ✓ |
| `client_city` | ✓ | ✓ |
| `client_city2` | — | ✓ |
| `client_contact` | — | ✓ |
| `client_country` | — | ✓ |
| `client_date_created` | ✓ | ✓ |
| `client_date_modified` | — | ✓ |
| `client_email` | — | ✓ |
| `client_email2` | — | ✓ |
| `client_email2_check` | — | ✓ |
| `client_email_check` | — | ✓ |
| `client_fax` | — | ✓ |
| `client_id` | ✓ | ✓ |
| `client_intake_notes` | — | ✓ |
| `client_integration_id` | ✓ | ✓ |
| `client_is_refferal` | — | ✓ |
| `client_last_integration_sync_result` | ✓ | ✓ |
| `client_last_integration_time_log` | ✓ | ✓ |
| `client_last_qb_sync_result` | — | ✓ |
| `client_last_qb_time_log` | — | ✓ |
| `client_lat` | — | ✓ |
| `client_lng` | — | ✓ |
| `client_main_intersection` | ✓ | ✓ |
| `client_main_intersection2` | — | ✓ |
| `client_maker` | — | ✓ |
| `client_mobile` | — | ✓ |
| `client_name` | ✓ | ✓ |
| `client_payment_driver` | — | ✓ |
| `client_payment_profile_id` | — | ✓ |
| `client_payments_statistic` | — | ✓ |
| `client_phone` | — | ✓ |
| `client_preferred_language` | — | ✓ |
| `client_promo_code` | — | ✓ |
| `client_qb_id` | — | ✓ |
| `client_rating` | — | ✓ |
| `client_referred_by` | — | ✓ |
| `client_source` | — | ✓ |
| `client_state` | ✓ | ✓ |
| `client_state2` | — | ✓ |
| `client_status` | — | ✓ |
| `client_tax_name` | — | ✓ |
| `client_tax_rate` | — | ✓ |
| `client_tax_text` | — | ✓ |
| `client_tax_value` | — | ✓ |
| `client_type` | ✓ | ✓ |
| `client_type_icon` | — | ✓ |
| `client_unsubscribe` | — | ✓ |
| `client_unsubsribed` | — | ✓ |
| `client_web` | — | ✓ |
| `client_zip` | ✓ | ✓ |
| `client_zip2` | — | ✓ |
| `contacts` | ✓ | ✓ |
| `disable_sync` | — | ✓ |
| `est_status_name` | ✓ | — |
| `estimate_id` | ✓ | — |
| `estimates` | — | ✓ |
| `estimator` | ✓ | — |
| `full_address` | ✓ | ✓ |
| `last_update` | — | ✓ |
| `lead_address` | ✓ | — |
| `lead_city` | ✓ | — |
| `lead_country` | ✓ | — |
| `lead_id` | ✓ | — |
| `lead_state` | ✓ | — |
| `lead_zip` | ✓ | — |
| `papers` | — | ✓ |
| `primary_contact` | — | ✓ |
| `qb_html` | ✓ | — |
| `status` | ✓ | — |
| `system_create` | — | ✓ |
| `system_update` | — | ✓ |
| `tags` | ✓ | ✓ |
| `tenant_id` | — | ✓ |
| `total_confirmed_estimates_amount` | ✓ | — |
| `total_declined_estimates_amount` | ✓ | — |
| `total_estimate_price` | ✓ | — |
| `total_pending_estimates_amount` | ✓ | — |
| `user_id` | ✓ | — |

### Leads

- Datatable: `GET /leads` — 23 columns
- Full entity: `GET /estimates/edit/{lead_id} → lead` — 81 columns
- **69 columns are only on the full endpoint** (what you miss with the datatable alone)

| Column | Datatable | Full entity |
| --- | :---: | :---: |
| `IsTaxRecomendationWarning` | — | ✓ |
| `address_line_display` | ✓ | — |
| `air_spading` | — | ✓ |
| `all_taxes_with_lead_tax` | — | ✓ |
| `arborist_consultation` | — | ✓ |
| `arborist_report` | — | ✓ |
| `client` | ✓ | ✓ |
| `client_id` | — | ✓ |
| `construction_arborist_report` | — | ✓ |
| `development` | — | ✓ |
| `emergency` | — | ✓ |
| `estimate` | — | ✓ |
| `estimator` | ✓ | — |
| `files` | — | ✓ |
| `form_id` | ✓ | — |
| `gclid` | ✓ | — |
| `hedge_maintenance` | — | ✓ |
| `landscaping` | — | ✓ |
| `last_update` | — | ✓ |
| `last_update_status` | — | ✓ |
| `latitude` | — | ✓ |
| `lead_add_info` | — | ✓ |
| `lead_address` | ✓ | ✓ |
| `lead_assigned_date` | ✓ | ✓ |
| `lead_author_id` | — | ✓ |
| `lead_autotax_name` | — | ✓ |
| `lead_autotax_rate` | — | ✓ |
| `lead_autotax_value` | — | ✓ |
| `lead_body` | — | ✓ |
| `lead_call` | — | ✓ |
| `lead_city` | — | ✓ |
| `lead_comment_note` | — | ✓ |
| `lead_contact_id` | — | ✓ |
| `lead_country` | — | ✓ |
| `lead_created_by` | ✓ | ✓ |
| `lead_date_created` | ✓ | ✓ |
| `lead_estimate_draft` | — | ✓ |
| `lead_estimator` | — | ✓ |
| `lead_gclid` | — | ✓ |
| `lead_groups` | — | ✓ |
| `lead_id` | ✓ | ✓ |
| `lead_json_backup` | — | ✓ |
| `lead_msclkid` | — | ✓ |
| `lead_neighborhood` | — | ✓ |
| `lead_no` | ✓ | ✓ |
| `lead_postpone_date` | ✓ | ✓ |
| `lead_priority` | ✓ | ✓ |
| `lead_reason_status` | — | ✓ |
| `lead_reason_status_id` | ✓ | ✓ |
| `lead_reffered_by` | — | ✓ |
| `lead_reffered_client` | — | ✓ |
| `lead_reffered_user` | — | ✓ |
| `lead_scheduled` | — | ✓ |
| `lead_services` | — | ✓ |
| `lead_source_details` | — | ✓ |
| `lead_state` | — | ✓ |
| `lead_status` | — | ✓ |
| `lead_status_id` | ✓ | ✓ |
| `lead_status_name` | ✓ | — |
| `lead_tax_name` | — | ✓ |
| `lead_tax_rate` | — | ✓ |
| `lead_tax_value` | — | ✓ |
| `lead_zip` | — | ✓ |
| `lights_installation` | — | ✓ |
| `longitude` | — | ✓ |
| `other` | — | ✓ |
| `planting` | — | ✓ |
| `preliminary_estimate` | — | ✓ |
| `root_fertilizing` | — | ✓ |
| `shrub_maintenance` | — | ✓ |
| `snow_removal` | — | ✓ |
| `spraying` | — | ✓ |
| `stump_removal` | — | ✓ |
| `system_create` | — | ✓ |
| `system_update` | — | ✓ |
| `tags` | ✓ | ✓ |
| `tax` | — | ✓ |
| `tenant_id` | — | ✓ |
| `timing` | — | ✓ |
| `tpz_installation` | — | ✓ |
| `tree_cabling` | — | ✓ |
| `tree_pruning` | — | ✓ |
| `tree_removal` | — | ✓ |
| `trunk_injection` | — | ✓ |
| `updated_at` | — | ✓ |
| `utm_campaign` | ✓ | — |
| `utm_content` | ✓ | — |
| `utm_medium` | ✓ | — |
| `utm_referral` | ✓ | — |
| `utm_source` | ✓ | — |
| `utm_term` | ✓ | — |
| `wood_disposal` | — | ✓ |

### Estimates

- Datatable: `GET /estimates` — 12 columns
- Full entity: `GET /estimates/edit/{lead_id} → lead.estimate` — 95 columns
- **90 columns are only on the full endpoint** (what you miss with the datatable alone)

| Column | Datatable | Full entity |
| --- | :---: | :---: |
| `arborist` | — | ✓ |
| `assets_display_services` | — | ✓ |
| `brand` | — | ✓ |
| `brush_disposal` | — | ✓ |
| `bucket_truck` | — | ✓ |
| `bucket_truck_operator` | — | ✓ |
| `chipper_operator` | — | ✓ |
| `client` | ✓ | — |
| `client_files` | — | ✓ |
| `client_files_entity` | — | ✓ |
| `client_id` | — | ✓ |
| `client_payments` | — | ✓ |
| `climber` | — | ✓ |
| `crane` | — | ✓ |
| `created_at` | — | ✓ |
| `date_created` | — | ✓ |
| `date_created_view` | ✓ | — |
| `date_due` | — | ✓ |
| `discount` | — | ✓ |
| `dump_truck` | — | ✓ |
| `email` | ✓ | — |
| `estimate_assets` | — | ✓ |
| `estimate_balance` | — | ✓ |
| `estimate_brand_id` | — | ✓ |
| `estimate_count_contact` | — | ✓ |
| `estimate_crew_notes` | — | ✓ |
| `estimate_groups` | — | ✓ |
| `estimate_hst_disabled` | — | ✓ |
| `estimate_id` | ✓ | ✓ |
| `estimate_integration_id` | — | ✓ |
| `estimate_item_equipment_setup` | — | ✓ |
| `estimate_item_estimated_time` | — | ✓ |
| `estimate_item_note_crew` | — | ✓ |
| `estimate_item_note_estimate` | — | ✓ |
| `estimate_item_note_payment` | — | ✓ |
| `estimate_item_team` | — | ✓ |
| `estimate_last_contact` | — | ✓ |
| `estimate_no` | ✓ | ✓ |
| `estimate_office_notes` | — | ✓ |
| `estimate_pdf_files` | — | ✓ |
| `estimate_planned_company_cost` | — | ✓ |
| `estimate_planned_crews_cost` | — | ✓ |
| `estimate_planned_equipments_cost` | — | ✓ |
| `estimate_planned_extra_expenses` | — | ✓ |
| `estimate_planned_overheads_cost` | — | ✓ |
| `estimate_planned_profit` | — | ✓ |
| `estimate_planned_profit_percents` | — | ✓ |
| `estimate_planned_tax` | — | ✓ |
| `estimate_planned_time` | — | ✓ |
| `estimate_planned_total` | — | ✓ |
| `estimate_planned_total_for_services` | — | ✓ |
| `estimate_portal_client_notes` | — | ✓ |
| `estimate_provided_by` | — | ✓ |
| `estimate_qb_id` | — | ✓ |
| `estimate_reason_decline` | — | ✓ |
| `estimate_review_date` | — | ✓ |
| `estimate_review_number` | — | ✓ |
| `estimate_scheme` | — | ✓ |
| `estimate_services_with_groups` | — | ✓ |
| `estimate_status` | ✓ | — |
| `estimate_tax_name` | — | ✓ |
| `estimate_tax_rate` | — | ✓ |
| `estimate_tax_value` | — | ✓ |
| `estimates_service` | — | ✓ |
| `full_cleanup` | — | ✓ |
| `groundsmen` | — | ✓ |
| `invoices` | — | ✓ |
| `is_blocked_project` | — | ✓ |
| `last_update` | — | ✓ |
| `last_update_status` | — | ✓ |
| `lead` | ✓ | ✓ |
| `lead_id` | ✓ | ✓ |
| `leave_wood` | — | ✓ |
| `notification` | — | ✓ |
| `paid_by_cc` | — | ✓ |
| `paymentFiles` | — | ✓ |
| `payment_files` | — | ✓ |
| `permit_required` | — | ✓ |
| `pw_certified_job_id` | — | ✓ |
| `recurring_project_id` | — | ✓ |
| `scheme_path` | — | ✓ |
| `scheme_source_path` | — | ✓ |
| `start_expiration_date` | — | ✓ |
| `status` | ✓ | ✓ |
| `stump_chips` | — | ✓ |
| `stump_grinder` | — | ✓ |
| `system_create` | — | ✓ |
| `system_update` | — | ✓ |
| `tags` | ✓ | — |
| `taxation_interests` | — | ✓ |
| `tenant_id` | — | ✓ |
| `tmp_notes_from_portal` | — | ✓ |
| `total_price` | ✓ | — |
| `tree_inventory_pdf` | — | ✓ |
| `tree_inventory_scheme_path` | — | ✓ |
| `unsubscribe` | — | ✓ |
| `updated_at` | — | ✓ |
| `user` | ✓ | — |
| `user_id` | — | ✓ |
| `wood_chipper` | — | ✓ |
| `workorder` | — | ✓ |
| `workorder_files_entity` | — | ✓ |

## What the opaque status numbers mean

Captured June 2026 from each module's `statuses` array. IDs are **not** contiguous or shared
across modules. `wo_status_id` / `lead_status_id` / `est_status_id` / `invoice_status_id` in
the exports map as follows.

**Warning: these are the status-*tab* definitions, and row-level status ids don't always use
the same id space.** Verified divergences in the June 2026 export: work order rows carry
`wo_status_id: 0` with `status: 'Finished'` (no row uses the tab table's 7), and estimate rows
use `status_id: 4` for Declined where the tab table says -4. Lead rows do match the tab ids.
When consuming rows, trust the status *name* on the row over these numbers.

### Leads — `lead_status_id`
| id | name | notes |
| --- | --- | --- |
| 1 | New | default tab; genuinely-open leads |
| 2 | For Approval | |
| 3 | No Go | lost/rejected; see reason codes below |
| 4 | Estimated | converted to an estimate (the bulk — ~1680) |
| 5 | Draft | |
| 6 | Spring PHC | seasonal campaign tag |

`lead_reason_status_id` (only set on **No Go** leads): 1 Don't provide this service ·
2 Out of service area · 3 Don't want work done anymore · 4 Already Done · 5 Duplicate lead ·
6 Hydro · 7 Dangerous tree no access · 8 Spam · 9 Already hired someone else ·
10 Lead not responding. (`0` = none.)

### Work Orders — `wo_status_id`
| id | name |
| --- | --- |
| 1 | Confirmed online |
| 2 | Confirmed |
| 3 | Scheduled - Confirmed |
| 4 | Scheduled - Pending |
| 5 | Stump Grinding |
| 6 | Firewood delivery |
| 7 | Finished by field worker |
| 8 | Unfinished |
| 9 | Complains |
| 10 | On hold |
| 11 | Repair |
| 13 | Winter Schedule |
| 14 | Spring PHC |
| 15 | Summer PHC |
| 16 | Planting |

### Estimates — `status_id`
| id | name |
| --- | --- |
| 1 | Draft / Unsent |
| 2 | Sent for approval |
| 3 | Pending approval |
| 6 | Confirmed |
| 7 | Contact the client |
| 8 | Thinking – No Follow Up Needed |
| 9 | Expired |
| 10 | Credit |
| -4 | Declined |

### Invoices (status tab the row falls under)
| id | name |
| --- | --- |
| 1 | Issued |
| 2 | Overdue |
| 3 | Sent |
| 4 | Paid |
| 5 | Hold Backs |
| 6 | Pending Payment |
| `overpaid` | Overpaid |

`-1` here is labelled **"All outstanding"** and deliberately excludes Paid invoices — the
reason the invoice export must enumerate every status id.

## Regenerating the endpoint map

`discover_endpoints.ts` drives the system Chrome (via `puppeteer-core`) around the app
starting from `/`, harvesting nav links and recording every XHR. Paste fresh cookies into its
`COOKIES` block (separate from `session.ts` — it sets browser cookies, not request headers)
and run `node scripts/arbostar/discover_endpoints.ts`. It rewrites `arbostar_endpoints.json`
(route metadata only — no response bodies or row data).
