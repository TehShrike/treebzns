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
| `lead_profile_details.ts` | Maps the lead, estimate, work order, and invoice fields of each profile `export_line_items.ts` fetches to `lead_profiles.js`, and the id → name lists in those responses to `profile_codebooks.js`. |
| `lead_notes.ts` | The lead-notes mapper `export_line_items.ts` applies to each estimate profile it fetches, and the fetcher for leads without an estimate, which reads the lead profile endpoint (verified 2026-09-22). **Must not use the estimate editor** — see "Editor pages write on load". |
| `fetch_clients.ts` | Thin typed wrapper over the generic fetcher, pinned to `/clients`. |
| `.arbostar_session.json` | **Credentials + account base URL. Gitignored — never committed.** Copy `.arbostar_session.example.json` to it and fill in. |
| `session.ts` | Loads `.arbostar_session.json` and exposes `BASE_URL` / `AUTH_HEADERS` / `BROWSER_COOKIES`. |
| `output.ts` | Reads/writes the `arbostar_export/` dir at the repo root — writes each dataset as `<name>.js` (`export default [...]`, gitignored). |
| `export_*.ts` | One run-now script per dataset. |
| `estimate_services.ts` | Reads the line items, and each line item's photos (`files`), out of an estimate profile. |
| `export_all.ts` | Runs every export script. Independent scripts run in parallel. `export_line_items.ts` (reads `estimates.js` / `leads.js`) and `export_images.ts` (reads `estimates.js` / `workorders.js`) wait for `export_estimates.ts`, `export_leads.ts`, and `export_workorders.ts`. |
| `discover_endpoints.ts` / `discover_details.ts` | Puppeteer crawlers that record the app's XHRs (list pages / detail pages). `discover_endpoints.ts` regenerates `arbostar_endpoints.json`. |
| `arbostar_endpoints.json` | Map of all ~36 list/XHR endpoints, with an example `path_and_query` for each. |

## Running an export

To run everything at once (parallel where dependencies allow, output prefixed per dataset):

```sh
node scripts/arbostar/export_all.ts
```

Or run one dataset at a time:

```sh
node scripts/arbostar/export_clients.ts      # -> clients.js (raw rows; contacts + address_related nested)
node scripts/arbostar/export_workorders.ts   # -> workorders.js (plus the exact latest status change time and the lead coordinates)
node scripts/arbostar/export_leads.ts        # -> leads.js (two passes + the KPI New Leads referral join)
node scripts/arbostar/export_estimates.ts    # -> estimates.js   (two passes)
node scripts/arbostar/export_invoices.ts     # -> invoices.js (one pass per status tab, to record each invoice's status)
node scripts/arbostar/export_line_items.ts   # -> line_items.js + lead_notes.js + lead_profiles.js + profile_codebooks.js  (reads estimates.js + leads.js; one profileData call per lead)
node scripts/arbostar/export_images.ts      # -> images.js + images/  (reads estimates.js + workorders.js; line item photos of active leads, see below)
node scripts/arbostar/export_payments.ts     # -> payments.js    (BI Client Payments report; see the payments section)
node scripts/arbostar/export_users.ts        # -> users.js       (user accounts; see the Users section)
node scripts/arbostar/export_taxes.ts        # -> taxes.js       (official tax list, scraped from /settings)
node scripts/arbostar/export_declines.ts     # -> declines.js    (decline reasons; see the Decline reasons section)
node scripts/arbostar/export_crew_roles.ts   # -> crew_roles.js  (Crew Roles page, scraped from /employees/crews; see the labor catalogs section)
node scripts/arbostar/export_tree_inventory.ts # -> tree_inventory.js + tree_inventory_sets.js  (see the tree inventory section)
```

Each dataset is written to `arbostar_export/<name>.js` as an ESM `export default [...]` (gitignored;
the committed `arbostar_export/<name>.d.ts` types it). `export_line_items.ts` reads
`estimates.js` and `leads.js`, so run those first. See
[`arbostar_export/readme.md`](../../arbostar_export/readme.md) for the output side.

Approximate volumes (June–August 2026): clients 1435, leads 2181, workorders 836,
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
- `map_markers_url` (optional) — origin of the tree-inventory markers microservice, e.g.
  `https://map-markers-ohio-master.arbostar.com`. Region-specific, so it is not derivable from
  `base_url`. In the app it is `Common.helpers.config_item('map_markers_url')`. Defaults to the
  Ohio host if omitted. Only `export_tree_inventory.ts` uses it.

The `[identifier]_session` cookie expires every couple of days. **Symptom of a stale
session: the export throws `request failed: 302`** (a redirect to the login page). The
tree-inventory set enrichment is the one exception — it throws `401` instead of `302`.

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

### Editor pages write on load (never fetch them)

Loading an ArboStar **editor** page is not a read. The estimate editor,
`GET /estimates/edit/{lead_id}`, creates a draft estimate for a lead that has none and moves
the lead to status **Draft** (`lead_status_id` 5). On 2026-09-12 an export fetched it for every
lead without an estimate and moved 198 production leads (11 New, 187 No Go) to Draft. The
same GET on a lead that already has an estimate has shown no side effect, but do not rely on
that either.

Rules:

- Never fetch `/estimates/edit/{lead_id}`, or any other `/edit/` or `/create` page, from an
  export or a probe. Treat every editor URL as a write.
- Read lead and estimate data from profile endpoints instead: the estimate profile
  `/estimates/profile/profileData/{lead_id}` (estimated leads only; it answers 500 otherwise)
  and the lead profile `/leads/leads/profileData/{lead_id}` (listed in
  `/assets/js/config/routes.js` as the data source of the `/{lead_no}-L` page). The lead
  profile passed the protocol on 2026-09-22, probed by hand with `probe_endpoint.ts` on a No
  Go lead and a New lead: both `/leads` rows were identical before and after. It is the
  source for leads without an estimate.
- Before adding any new per-record endpoint, confirm it backs a view page, not an edit page,
  and check it against a lead that has no estimate.

The rule is enforced in code. `fetch_json` (`fetch_record.ts`) refuses any path that is not
listed in `verified_endpoints.ts`, and both fetchers refuse `/edit/`, `/create`, and the other
mutation segments outright. To verify a candidate, run
`node scripts/arbostar/probe_endpoint.ts --lead_id <n> --path <path>` on a No Go lead with no
estimate and then on a New lead: it snapshots the lead's `/leads` row, requests the path once,
re-reads the row, and exits nonzero if anything moved. Only then add the pattern to
`verified_endpoints.ts`. The full protocol is in
`src/notes/2026-09-22-safely-read-lost-data.md`.

### The status-filter gotcha (why estimates/invoices/leads need two passes)

Each list is scoped by a **status tab**, passed as repeated `status_ids[]` params. There's a
`-1` "All" sentinel — **but what `-1` actually returns is inconsistent per module**, and the
on-screen default view is almost never the full dataset:

| Module | `status_ids[]=-1` returns | Full dataset needs |
| --- | --- | --- |
| `/workorders` | full history (836) ✅ | `-1` is enough |
| `/estimates` | full history incl. declined (1684) ✅ | `-1` is enough |
| `/leads` | only **active** leads (~4) ❌ | every status id (most leads become "Estimated" and leave the view) → 2181 |
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

**Lead notes** — the same profile endpoint as line items below. Its `lead` object carries
`lead_body` (the Lead Description box on the lead profile), `lead_source_details` (the free
text behind an "Other" lead source), and `lead.estimate.estimate_crew_notes` /
`estimate_office_notes`. `lead_notes.ts` maps them from the profile `export_line_items.ts`
fetches for every estimated lead. The profile endpoint answers 500 for a lead with no
estimate. Those leads used to get one **editor** fetch each, which is what moved 198 leads to
Draft (see "Editor pages write on load"). Their source is the lead profile endpoint,
`GET /leads/leads/profileData/{lead_id}` (`lead_profile_path` in `lead_notes.ts`), verified
on 2026-09-22 on a No Go lead and a New lead. It answers 200 with about 20 KB. Top-level keys
are `lead`, `allTaxes`, `leadStatuses`, `reasons`, `leadPriority`, `reference`, `estimators`,
`services`, `products`, `bundles`, `groups`, and `title`. The `lead` object carries
`lead_body` and `lead_source_details` under the same names as the profile, and `lead.estimate`
is an empty array (not null) for a lead with no estimate, which `to_lead_notes` maps to empty
estimate notes. `export_line_items.ts` runs that pass while the path is listed in
`verified_endpoints.ts` and prints a skip line naming the probe command if it is not.

**Line items** — `GET /estimates/profile/profileData/{LEAD_id}`, rows at
`lead.estimate.estimate_services_with_groups` (standalone items and service groups in display
order, with each group's children nested inside it; see the service groups bullet):

- **Keyed by lead id, NOT estimate id.** `/estimates/profile/profileData/1696` loads the
  estimate for *lead* 1696, which is a different estimate than the one whose DB `estimate_id`
  is 1696. Use the `lead_id` from `estimates.js` (it's 1:1 with estimates here). The returned
  line items' `estimate_id` then matches the list's `estimate_id`. The app URL `/{lead_no}-E`
  (the estimate profile page) is what loads this endpoint — it is defined in
  `/assets/js/config/routes.js`, which is also where to look for other per-record endpoints.
- The **estimate editor** (`GET /estimates/edit/{LEAD_id}`) **writes on load** (see "Editor
  pages write on load") and must not be fetched. For the record, it returns the same
  `estimates_service` rows (same fields, including the nested `service`/`status`/`crew`
  joins), but its payload is ~355 KB — it re-sends the whole service catalog (`tree_types`
  alone is ~694 entries) on every call — vs ~50–170 KB for the profile. Measured August 2026:
  the profile sustains ~4.4 req/s against the editor's ~2, and raising concurrency past 6
  changes neither (the server serializes requests that share a session), so the profile is
  the fastest known source. There is no bulk/multi-estimate endpoint: the closest are the BI
  KPI Revenue reports (`GET /business_intelligence/kpi_revenue_completed/datatables` +
  `kpi_revenue_in_progress/datatables`, standard GET datatables scoped by
  `report_date_from`/`report_date_to` in `MM/DD/YYYY` — a too-wide range like 2015–2099
  silently returns 0 rows), which do return one row per line item (`id` = the line-item id)
  but only for **scheduled** work, with a thin projection (no description, quantity, crews,
  or flags). Unscheduled, declined, and pending estimates are absent, so they cannot replace
  the per-estimate fetch.
- **One source covers everything.** Each `estimates_service` row carries `estimate_id`,
  `invoice_id`, and `parent_invoice_id`. When an estimate is invoiced those rows get an
  `invoice_id`; work orders schedule the same rows. So invoices and work orders have **no
  separate line-item JSON endpoint** (the invoice editor renders them into HTML) — filter
  `line_items.js` by `invoice_id` instead.
- **Service groups nest their line items under `estimate_services_with_groups`.** A group
  ("Tree Removal Plus") is a row with `type: 'group'` and its own id sequence — group ids
  collide with line-item ids, which is why the pre-profile export produced duplicate ids with
  all-null phantom rows (the importer's `data_score` dedupe exists for those old exports).
  The profile payload carries the items three ways. `estimates_service` holds the standalone
  items only. `estimate_groups` holds the group headers with empty children. And
  `estimate_services_with_groups` (verified 2026-09-22 on lead 1422) is the display-order
  array the profile page renders: standalone items (`type: 'item'`, same shape as
  `estimates_service` rows) interleaved with group rows (`type: 'group'`, keys `id`,
  `estimate_id`, `estimate_group_id`, `name`, `description`, `show_items`,
  `show_invoice_items`, `sort_order`, `total`, `type`, `sort_index`, `serviceIndex`,
  `estimates_services`). Each group's `estimates_services` array holds its child line items
  with the full item shape (own `id`, `estimate_id`, `invoice_id`, `service_price`,
  `service`, `status`, `service_crews`, `sort_order`, and `estimate_group_id` set to the
  group's id). Child rows lack `upcoming_event_ids`, `sort_index`, and `bundles_services`
  and carry an extra `parentIndex`; none of those are exported. On lead 1422
  `estimates_service` is items 2484 and 2491, while `estimate_services_with_groups` is item
  2484, group 1 "Tree Removal Plus" with children 2485, 2486, 2487, then item 2491. The
  export reads `estimate_services_with_groups`, takes item rows directly and group rows'
  children, never a group row itself, and falls back to `estimates_service` only when the
  array is absent. The run prints how many estimates had groups and how many exported line
  items came from inside one. The old editor-only export dropped grouped line items entirely.
- Line totals won't sum to the estimate total: `optional` lines and discounts are applied on top.
- **More than the line item basics.** Each row also carries the status id, the time and user
  of the latest status change (`status_log`), the Completed day (`completed_status_date`),
  total labor hours (`service_times_with_crew`, which is `service_time` times the crew
  count), travel time, crew role ids, equipment and tool names, the group id, schedule
  event ids, and the metadata of every file on the line item. `system_create` and
  `system_update` are 2026-04-19 on every row that existed when ArboStar moved the account.

**Lead profiles** — the rest of each profile response goes to `lead_profiles.js`, one row per
lead. From the `lead` object: coordinates, the estimator and creator user ids, the lead
source id (`lead_reffered_by`), the No Go reason id, `timing`, `preliminary_estimate`,
priority, the latest status change time, and every file on the lead that is not a line item
photo (payment receipts, signatures, invoice files). From `lead.estimate`: the exact creation
time, the decline reason id (`estimate_reason_decline`), the latest status change time (the
decline time on a declined estimate), deposit and signature settings, discount, totals, the
service groups, and `emails[]`, which is every time ArboStar emailed the estimate with its
delivery status. From `lead.estimate.workorder`: office and crew notes, how the client
confirmed, priority, the latest status change time, and the crew's completion report. From
`lead.estimate.invoices[]`: the status id, the due, overdue, and paid dates, interest
charges, and the accounting integration ids. Leads without an estimate get the `lead` part
from the lead profile.

**Profile codebooks** — every profile response repeats the same id → name lists.
`profile_codebooks.js` keeps one copy of each: lead sources (`reference`), No Go reasons
(`reasons`), and lead statuses from the lead profile, and estimate statuses, estimate decline
reasons (nested in each estimate status as `reason`), work order statuses, and payment
methods from the estimate profile.

## Line item photos (`export_images.ts`)

This export downloads line item photos only. The estimate profile
(`/estimates/profile/profileData/{lead_id}`) lists them in each line item's `files` array. A
work order shows its estimate's line item photos. `estimate_pdf_files` on the estimate only
repeats the `full_path` of the photos that go in the PDF. The lead also has files of its own.
See "Other files on a lead" below.

Each file has an `id`, `owner_id` (the line item id, which is also the API line item id),
`original_filename`, `type`, `filesize`, `full_path`, a `thumbnail` path, the uploader's
`user_id`, company-local `system_create` / `system_update` times, and the flags
`is_estimate_pdf`, `is_workorder_pdf`, `is_invoice_pdf`, and `is_shared`. `full_path` looks
like `uploads/clients_files/<client_id>/estimates/<estimate_no>/<line_item_id>/<hash>.jpg`.
It downloads from the account origin with no cookie or token.

The export fetches only active leads: every work order that is not Finished, every estimate
that is Draft / Unsent or Contact the client, and Sent for approval estimates created in the
last 30 days. The estimate list has no update date, so the cutoff uses `date_created`. The
photos go to `arbostar_export/images/<id>.<extension>` (gitignored) and the rows to
`images.js`. A photo already on disk is not downloaded again. The profile's `filesize` is
stale for some photos (a 424309-byte listing downloads as a complete 407725-byte JPEG), so
the export checks each download against `content-length` and records the size on disk.

### Other files on a lead

The lead's own `files` are in `lead_profiles.js` at `lead.files`, with metadata only. The
export does not download them, and the importer does not import them. Each file's
`module_type` says what it is. The counts are from the September 30 2026 export.

| `module_type` | Files | What it is |
| --- | --- | --- |
| `estimate` | 365 on 179 leads | Estimate photos. 364 go in the estimate PDF. 4 repeat a line item photo. |
| `lead` | 338 on 152 leads | Photos on the lead from before the estimate, and a few videos and text files. Paths are under `leads/<lead_id>/` or `leads/<lead_no>/`. |
| `invoice` | 1435 on 432 leads | Photos with camera file names. 1433 go in the invoice PDF. They are probably the crew's after-work photos, but nobody has checked. None repeat a line item photo. |
| `signature` | 475 | The client's signature, `signature.png`. |
| `scheme` | 67 | The site sketch, `pdf_estimate_no_<estimate_no>_scheme.png`. |
| `workorder` | 1552 | Payment files under `uploads/payment_files/<client_id>/<payment_id>/`: receipt PDFs such as `payment_<payment_id>_1.pdf`, and 708 images, probably photos of checks or receipts. |

The `estimate`, `lead`, and probably the `invoice` files are project photos. They would
become `project_image` rows with no `project_line_item_image` row. Signatures, sketches, and
payment files are not project photos.

## Labor catalogs: crew roles

Crew roles have no JSON endpoint. `export_crew_roles.ts` scrapes the server-rendered **Crew
Roles** page, `GET /employees/crews` with `accept: text/html` and the session headers (the
same way `export_taxes.ts` reads `/settings`), and writes `crew_roles.js`. Verified
2026-09-22: the page has exactly one `<table>` with thead columns Crew Name, Crew Role, Crew
Color, Cost Per Hour, Action. Each data row is `<tr class=" " data-id="7">` with cells
`<td>CL3</td>`, `<td>Arborist Climber</td>`, a `<td>` holding a `<span>` whose style carries
`background-color: #1bf26d`, `<td class="text-right"> 180.00 </td>`, and an action cell whose
`<a class="... deleteCrew" ...>` carries `data-delete_id` and `data-status="1"`. Rows appear
in priority order (row 1 = priority 1). A fourteenth row with `data-id="0"`, name "Day Off",
empty role, rate "-", and no `data-status` is a pseudo-row: the script skips any row whose
id is 0 or whose rate is not a number. The 13 real rows matched the 2026-09-12 editor-based
file exactly (ids, codes, rates, colors, status, priority).

The script maps the page onto `crew_roles.js`: `crew_id` from `data-id`, `crew_name` = Crew
Name (the code), `crew_full_name` = Crew Role, `crew_rate` = Cost Per Hour as a number,
`crew_status` from `data-status`, `crew_color` from the swatch's background-color, and
`crew_priority` = the 1-based position among the real rows. September 2026: CL0–CL3
(Arborist Climber, $70–$180/hr), BM1/BM2 (Bucket Truck Operator, $80), GM (Groundsman,
$160), STU (Stump Grinder Operator, $180), TEC (Technician, $309), ISA (ISA Arborist, $120),
AC1/AC2 (Consulting Arborist, $309/$120), REP (Repair, $65).

The pruning work types (the `ip_*` catalog: Clean canopy, Crown reduction, ...) used to be
exported to `work_types.js` from the estimate editor alongside the crew roles. The editor
writes on load (see "Editor pages write on load"), nothing consumed the file, and no
read-only source is known, so work types are no longer exported. They attach to tree
inventory trees, not to line items. Each tree's `work_types[]` holds `{ ip_id, text }` pairs,
e.g. `{ ip_id: 7, text: 'DW:Deadwood' }`. In September 2026, 20 of 45 trees had one or more.

How crew roles map to jobs:

- **Line item → crew roles** is already exported: each row in `line_items.js` carries a
  comma-joined `crews` string (e.g. `'CL3, GM'`) whose codes match `crew_roles.js` `crew_name`.
  In the raw editor payload the same link is the per-line `crew[]` array, whose `pivot`
  rows (`crew_service_id` = line item id, `crew_user_id` = crew_id) are the join table.
  Since line items carry `estimate_id` and `invoice_id`, this one string covers the
  estimate → skills and work-order → skills mapping.
- The estimate entity also has per-role requirement flags (`climber`, `groundsmen`,
  `bucket_truck_operator`, ...), each `'yes'`/`'no'` — a coarser signal than the line-item
  `crews` string.

## Tree inventory (`export_tree_inventory.ts`)

Trees are not in the main ArboStar database. Each is a **marker** in a separate microservice
(`map_markers_url`, e.g. `https://map-markers-ohio-master.arbostar.com`). The service stores
one search index per **tree inventory set**, named `{subdomain}-treeInventory-{tis_id}`, and a
`POST /markers` with `{searchIndex, filters:{}, perPage:-1}` returns that set's trees as GeoJSON
(`features[]`, plus `marker_count_total`). Two things make this easy to scrape:

- **The markers service is unauthenticated.** It trusts the index name — no cookie, no CSRF. So
  the trees export needs no session (the export reads them with plain `fetch`).
- **`searchIndex` is an exact index name — no wildcard.** `dufftreeservice-treeInventory-*` and
  bare `dufftreeservice` both return an empty set, not a union. So there is no single
  "all trees" query.

A **set** (`tis_id`) is a client's property map. The app keys sets by client
(`POST /treeInventory/indexData/{client_id}`, which returns set metadata + `markers_count`, and
auto-creates an empty set the first time a client's map is opened). Listing every set the app's
own way is one request per client (~1700). The export skips that: `tis_id` is a small **global**
sequence, so it walks `tis_id` from 0 against the unauthenticated markers service and stops after
`EMPTY_RUN_LIMIT` (10) tis_ids in a row return no trees. Empty sets occur inside the used range
(auto-created, never filled), so the limit must clear the largest such gap — 5 in the August 2026
data, hence 10. August 2026: **15 trees across 10 sets** (`tis_id` 3–24), everything above ~25
empty.

Two files:

- **`tree_inventory.js`** — one row per tree (flattened GeoJSON feature): `ti_id`, `tis_id`,
  `tree_number`, `species_id`/`species_name`/`species_color`, `priority`/`priority_label`
  (condition: good/fair/poor…), `size`, `cost`, `stump_cost`, `remark`, `lat`/`lng`, and the raw
  `work_types` / `recommended_services` / `files` arrays. In September 2026, 20 of 45 trees
  had work types, 33 had files, and none had recommended services. Written **first**,
  before any authed call, so a stale session never costs the tree data.
- **`tree_inventory_sets.js`** — one row per set that has trees, enriched from
  `POST /treeInventory/show/{tis_id}` (**authed**, ~10 calls, only the non-empty sets):
  `tis_id`, `tis_name`, `tis_client_id`, address, `tis_lat`/`tis_lng`, `markers_count`,
  `created_at`/`updated_at` (Unix seconds), `deleted_at`, `overlay_path`, `file`, and
  `estimates` (the estimates made from the set's map, as `{ estimate_id, estimate_no }`).

Plus two global reference catalogs the same script dumps:

- **`tree_species.js`** — the species catalog (`POST /treeInventory/trees/loadData`), 694 rows of
  `{species_id, species_name, species_color}`. A tree's `species_id` joins here.
- **`tree_priorities.js`** — the condition/priority codebook
  (`POST /treeInventory/markersPriority/loadData`), 9 rows of `{tip_id, priority, priority_label,
  color}`. A tree's `priority` joins on `priority`. (The app calls it "priority" but the values
  are conditions: Low, Mid, High, Excellent, Good, Fair, ...)

Both catalogs are select2-style dropdown feeds: `{items, total_count}`, paged at 100 (a `perPage`
override errors), so the export walks `page` until it has every row.

**A tree has no client id** — only `tis_id`. Join `tree_inventory.js.tis_id` →
`tree_inventory_sets.js.tis_id` for `tis_client_id`, then → `clients.js.client_id`. `cost` /
`stump_cost` are raw API numbers — normalize with `#shared/arbostar/arbostar_number_to_fnum.ts`.

## Payments (`/business_intelligence/clientPaymentsDatatable`)

Every payment in the account comes from one paged datatable: the Business Intelligence →
Client Payments report (`POST /business_intelligence/clientPaymentsDatatable`). This replaced
the old approach of one `POST /clients/profile/getClientPayments` per client (~1435 requests).
Rows are the **full raw payment records**, richer than the per-client endpoint: the same
`payment_projects` allocation rows (per-allocation amounts, each embedding its estimate's
`lead_id`), plus the full `payment_method` record, `payment_transaction` (gateway details),
`users` (the recording user), and QB sync fields.

Besides the money fields, the export keeps the receipt file name and directory
(`payment_file`, `payment_path_file`), `payment_checked`, `payment_integration_id`,
`system_create` (when someone recorded the payment, company-local) and `system_update`, the
allocations' `created_at`/`updated_at`, and the card processor's transaction record as
`transaction` (processor, reference id, amount, approval, date, response message, auth code).
It leaves out the card number and the raw gateway log, the recording user's record, the nested
estimate / invoice / payment copies on each allocation, and the QB sync logs.

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

Besides the profile fields, the export keeps `employee_id` (the employee record id), `emp_type`,
the Field Estimator and Field Worker checkboxes, the default estimator flag, `is_appointment`,
`is_tracked`, the crew leader flag, the crew skill checkboxes (driver, climber, ground,
technique), `emp_status`, `emp_pay_frequency`, the work day start and end times, the license
number, and the account's `added_on`, `updated_on`, and `last_login` instants (UTC).

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
- Full entity: `GET /estimates/edit/{lead_id} → lead` — 81 columns. **Do not fetch it**: it
  writes on load (see "Editor pages write on load"). The same `lead` object is on the
  estimate profile for estimated leads; the lead profile endpoint is the candidate for the rest.
- **69 columns are only on the full endpoint** (what you miss with the datatable alone)

The lead source (the lead form's "Referred by" select) is on neither in usable form: the full
entity only carries the codebook *id* (`lead_reffered_by`), and no endpoint serving the
id → name codebook has turned up. `export_leads.ts` instead resolves the names from the BI
KPI New Leads report (`GET /business_intelligence/kpi_new_leads/datatables` — a standard GET
datatable scoped by `report_date_from`/`report_date_to` instead of statuses) and joins its
`referred_by` / `referred_by_name` columns onto each lead by `lead_id`.

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

The invoice rows have no status field. So `export_invoices.ts` uses
`fetch_all_rows_with_status()`, which fetches each numbered status tab on its own and records
the tab that returned each row as `status_id` and `status_name`. It then runs a `-1` pass to
catch rows that no numbered tab returned. It throws if a row shows up in two numbered tabs.
The Overdue tab returns no rows when filtered by its own id (`status_ids[]=2`), even though
its count is 15 (September 2026). "All outstanding" returns the 24 Sent invoices plus exactly
those 15. So the export labels the invoices that only the `-1` pass returned as Overdue, and
asserts that their count matches the Overdue tab's `invoices_count`.
`overpaid` is a filter over Paid invoices, not a status, so the export skips it.

## Regenerating the endpoint map

`discover_endpoints.ts` drives the system Chrome (via `puppeteer-core`) around the app
starting from `/`, harvesting nav links and recording every XHR. Paste fresh cookies into its
`COOKIES` block (separate from `session.ts` — it sets browser cookies, not request headers)
and run `node scripts/arbostar/discover_endpoints.ts`. It rewrites `arbostar_endpoints.json`
(route metadata only — no response bodies or row data).

## Company timezone

No endpoint exposes the company timezone as a field (checked 2026-09-01: the page shells,
the full settings key/value table, `/user/getData`, `/settings/getLocations`, and the client
JS bundles — the server renders all datetimes company-local, so the zone name never ships).
Two GET endpoints still reveal it:

- `GET /estimates/profile/profileData/{lead_id}` returns the same event twice on the lead:
  `updated_at` as a UTC ISO-Z instant and `last_update` / `system_update` as a company-local
  string. The difference is the current UTC offset. Use a recently-updated lead — a data
  migration rewrote old `system_*` values.
- The `/workorders` datatable serializes `date_created` (a company-local date) as UTC
  ISO-Z midnight, so every row embeds the offset. Rows ordered by `date_created` show the
  standard and daylight offsets and the exact DST flip date, which pins the IANA zone.

Do not use the `timeshift` query param on `schedule/office/data` — the app fills it from the
browser's `getTimezoneOffset()`, so it reflects the viewer, not the tenant.
