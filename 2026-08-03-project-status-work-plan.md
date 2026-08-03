# 2026-08-03 Project status work plan

Model client accept/decline outcomes that are currently only implicit (see
`arbostar_client_state_differences.md`): an active client "no" at the proposal stage becomes a
real state ("Declined Proposal") with a structured reason, work-order cancellation gets
"Cancelled Work Order", and the ArboStar import records decline reasons it previously discarded.

## Resolved questions

Asked and answered 2026-08-03:

1. **Which dead-at-estimate states move to "Declined Proposal" on import?** Declined only.
   Expired and Thinking–No-Follow-Up stay as today (closed while on the Proposal document), so
   an active "no" stays distinguishable from silence.
2. **ArboStar's 15 real decline reasons vs the 6 seeds?** Map onto the 6 where the mapping is
   natural; where it isn't, leave `project_decline_reason_id` NULL (the reason name still
   survives in `lead_details` prose). Mapping table below.
3. **Extra columns from model-project-terminal-states.md?** Also add
   `project_document.declined_project_document_id` (Proposal → Declined Proposal, work-order
   documents → Cancelled Work Order). `ask_for_decline_reason` and a free-text
   `project.decline_reason` column are deferred to the round that builds the in-app decline UI.

## ArboStar findings (data not currently exported)

- **`GET /estimates/declines`** (DataTables protocol: `from`/`to` + `draw`/`start`/`length` +
  a declared order column, headers `x-requested-with: XMLHttpRequest` and
  `x-request-type: datatable`) returns **every declined estimate with its decline reason** —
  `estimate_id`, `estimate_reason_decline` (id), `reason_name`, client info, `total_price`,
  `date_created` — 362 rows in one paged list, no per-record fetches. The bare endpoint 500s
  without the DataTables params (that's why it looked broken on first probe).
- The same response carries `reason_status.labels`: the tenant's full 15-entry canned
  decline-reason list, ordered such that reason id N = `labels[N-1]` (verified against row
  data). Rows also embed `reason_name` directly, so the export doesn't depend on that ordering.
- The full estimate entity (`/estimates/edit/{lead_id}` → `lead.estimate`) also carries
  `estimate_reason_decline`, but the declines datatable is strictly cheaper.
- **ArboStar has no cancelled-work-order concept** (checked the workorders module JS and status
  tables; only line-item-level declined status exists, already exported). "Cancelled Work
  Order" is forward-looking — the import never maps anything to it.
- Rows in `/estimates/declines` don't carry `lead_id`; join to `estimates.js` by `estimate_id`.
- The declines endpoint reports 362 rows vs 330 status-Declined estimates in the July
  `estimates.js` — new declines since that export, plus reasons that outlive a later status
  change (e.g. reason "Expired"). Re-run `export_estimates.ts` alongside the new declines
  export so the two datasets are from the same moment.

## ArboStar reason → seed reason mapping

Counts are current usage across all 362 declined estimates (fetched 2026-08-03).

| ArboStar id | ArboStar reason | Count | Maps to |
| --- | --- | --- | --- |
| 1 | Price is too high | 171 | Price too high |
| 3 | Preferred the competition | 98 | Went with a lower bid |
| 4 | Not interested in the job anymore | 62 | NULL |
| 6 | Scheduling delays/conflicts | 10 | Scheduling troubles |
| 15 | Expired | 7 | NULL |
| 7 | Client can't be pleased | 4 | Weren't pleased |
| 5 | Unable to reach the client | 2 | NULL |
| 12 | No follow-up | 2 | NULL |
| 2 | Unclear Estimate | 2 | NULL |
| — | (no reason recorded) | 2 | NULL |
| 13 | Municipal tree | 1 | NULL |
| 14 | Declined Permit | 1 | NULL |
| 8 | Estimator didn't contact the client | 0 | NULL |
| 9 | Estimate doesn't provide the service client wanted | 0 | NULL |
| 10 | Customer service | 0 | NULL |
| 11 | Company reputation | 0 | NULL |

Mapped: 283 of 362. The seeds "Didn't like credentials" and "Financial troubles" have no
ArboStar source. The import matches on `reason_name` (not id), so tenant list reorders don't
matter.

## Steps

### 1. Migration `src/migration/0031-project-decline-modeling.sql`

Target end state for `project_document` (global codebook, currently 7 rows):

| sort | name | declined | closed_by_default | declined_project_document_id |
| --- | --- | --- | --- | --- |
| 1 | Lead (Unqualified) | 0 | 0 | NULL |
| 2 | Lead (Qualified) | 0 | 0 | NULL |
| 3 | Proposal *(renamed from Estimate)* | 0 | 0 | → Declined Proposal |
| 4 | Work Order | 0 | 0 | → Cancelled Work Order |
| 5 | Work Order (Errand) | 0 | 0 | → Cancelled Work Order |
| 6 | Work Order (Customer Sat) | 0 | 0 | → Cancelled Work Order |
| 7 | **Declined Proposal** (new) | 1 | 1 | NULL |
| 8 | **Cancelled Work Order** (new) | 1 | 1 | NULL |
| 9 | Void *(sort 7 → 9)* | 0 | 1 | NULL |

- `ALTER TABLE project_document`: add `declined BIT(1) NOT NULL DEFAULT 0`,
  `closed_by_default BIT(1) NOT NULL DEFAULT 0`,
  `declined_project_document_id INT UNSIGNED NULL` (no FK — the schema doesn't use FK
  constraints anywhere).
- `UPDATE` Void: `closed_by_default = 1`, `sort = 9`.
- `UPDATE` Estimate: `name = 'Proposal'`.
- `INSERT` Declined Proposal (sort 7) and Cancelled Work Order (sort 8), both
  `declined = 1, closed_by_default = 1`, everything else default/false — capture ids with
  `LAST_INSERT_ID()` like migration 0004 does.
- Point `declined_project_document_id`: Proposal → Declined Proposal; all three
  `should_be_worked` documents (Work Order, Errand, Customer Sat) → Cancelled Work Order.
  *Assumption:* Errand/Customer Sat cancellations also read naturally as "Cancelled Work
  Order"; flag if they should decline nowhere instead.
- `CREATE TABLE project_decline_reason` following the `payment_method` precedent (0019/0023):
  `project_decline_reason_id INT UNSIGNED AUTO_INCREMENT` PK, `company_id INT UNSIGNED NOT
  NULL`, `reason VARCHAR(200) NOT NULL`, `created_at`/`updated_at DATETIME NOT NULL DEFAULT
  (UTC_TIMESTAMP())`, `UNIQUE KEY (company_id, reason)`.
- Seed the 6 reasons for every existing company with the `CROSS JOIN` pattern from 0019:
  Price too high · Went with a lower bid · Weren't pleased · Didn't like credentials ·
  Scheduling troubles · Financial troubles.
- `ALTER TABLE project ADD COLUMN project_decline_reason_id INT UNSIGNED NULL`.

Apply with `pnpm run local:db_up` (never the mysql cli) — this also regenerates
`schema/` types/validators.

### 2. Company creation seeds the reasons

`src/worker/lib/db/create_company.ts`: insert the same 6 reasons inside the creation
transaction, mirroring the `default_payment_method_names` block.

### 3. Fix `resolve_context.ts` document resolution (breaks without this)

`src/shared/arbostar/resolve_context.ts` resolves `void` as "all four behavior flags false" and
asserts exactly one match — the two new documents also have all-false behavior flags, so the
assert fires on the next import run after the migration. Changes:

- `void`: match `closed_by_default: true, declined: false` (per Josh, 2026-08-03).
- Add `declined_proposal` and `cancelled_work_order` ids, resolved via the routing column:
  the document that Proposal's / Work Order's `declined_project_document_id` points at —
  no name matching needed.
- Extend the `ArbostarImportContext.project_document_ids` type in `import_common.ts`, and add
  the new columns to the document query's select list.

### 4. New export: `scripts/arbostar/export_declines.ts` → `arbostar_export/declines.js`

- Page `/estimates/declines` (wide `from`/`to` range, e.g. 01/01/2015–12/31/2026, length 200)
  with the DataTables params above. Reuse `fetch_datatable.ts` if its param shape fits
  (it may need the extra `from`/`to`/`status_reason_ids_mode` passthrough); otherwise a small
  bespoke pager in the script.
- Output per row: `estimate_id`, `estimate_reason_decline`, `reason_name`, `client_id`,
  `date_created`, `total_price`. Commit a matching `arbostar_export/declines.d.ts` (data file
  stays gitignored like the rest).
- Document in `scripts/arbostar/readme.md`: the endpoint, its required params, and the
  15-reason id table.

### 5. Import changes

- `scripts/import_arbostar_export.ts` + `ArbostarExportData`: add `declines` dataset.
- `src/shared/arbostar/import_projects.ts`:
  - New document rule: a lead whose estimates are all dead **and at least one is status
    Declined** → `documents.declined_proposal` (instead of closed-on-Proposal). All-dead with
    no Declined (Expired/Thinking only) keeps today's mapping. `closed` stays true for both —
    add declined-document projects to the existing `closed` expression.
  - Reason: from `declines.js` via `estimate_id` (most recent declined estimate wins if a lead
    has several with different reasons), `reason_name` → seed reason per the mapping table
    (a small `Map` in the import) → the company's `project_decline_reason_id`, resolved from a
    company-scoped query of `project_decline_reason` (add to `resolve_context` alongside the
    other lookups). Unmapped or missing → NULL.
  - `project_decline_reason_id` joins the ArboStar-derived columns so re-imports update it.
- `src/shared/arbostar/arbostar_import_notes.md`: document what does/doesn't survive
  (Expired/Thinking still conflated by choice; unmapped reasons → NULL with prose in
  `lead_details`).

### 6. Verify

- `pnpm run test` (includes all type checks). The regenerated schema types flow through the
  query-builder tests on their own.
- Re-run `export_estimates.ts` + new `export_declines.ts`, then
  `dotenv -- node scripts/import_arbostar_export.ts --company_id 9` against local dev; spot-check:
  ~330+ projects on Declined Proposal, reason distribution roughly matching the mapping table
  (~283 non-null), Expired/Thinking-only leads still closed on Proposal, Void count unchanged.
- Projects search UI (`Projects.State.svelte`) lists documents by name — the new documents
  appear with no code change; eyeball the filter dropdown.

### 7. Doc updates (last)

- Update `arbostar_client_state_differences.md`: Declined and its reasons are now
  representable; note what deliberately remains lossy.
- Fold the implemented subset out of `model-project-terminal-states.md` or mark items done
  (expiration behaviors, `ask_for_decline_reason`, free-text reason remain open).

## Known quirks / out of scope

- ~~`export_schema.ts` mapped `tinyint` to `boolean`~~ — fixed 2026-08-03: `tinyint` now maps
  to `bigint` (matching the runtime typecast in `connection.ts`), schema regenerated, and the
  hand-maintained `schema/validator/project_document.ts` updated (`sort: jv.is_bigint`).
  `project_document.sort` was the only tinyint column; all real booleans are `bit(1)`.
- No in-app decline UI this round — `declined`, `closed_by_default`, and
  `declined_project_document_id` are consumed by the import now and by the UI later.
- Expiration behaviors from the notes file (search-visibility cutoff, no auto-approve after
  expiry) are untouched.
