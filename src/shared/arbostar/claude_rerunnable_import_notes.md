# Re-runnable ArboStar import — working notes

Goal: `scripts/import_arbostar_export.ts` should be safe to run repeatedly for the same
company — first run inserts, later runs update rows that already exist and insert new ones.
Today the import is **not idempotent** (running it twice doubles every row) and re-importing
the same users fails on the globally unique `employee.email` / `employee.login_name` keys.

Status: **implemented and verified (July 2026)**. All importers are update-or-insert, each
phase runs in its own transaction, and the import was run three times against the test
company (9) — first run inserts, later runs update everything with zero duplicates, zero
deletes, stable row counts. Remaining loose ends are in "Open items" at the bottom.

## Approach

No `ON DUPLICATE KEY UPDATE` anywhere: the relevant unique keys don't include `company_id`,
and it burns auto-increment ids on the non-insert path. Instead, make the ArboStar → local
correlation durable, so a re-run knows up front whether each incoming entity is an UPDATE or
an INSERT and issues plain statements accordingly. Per-table columns, not a generic mapping
table (decided against a mapping table).

No reliance on duplicate-key exceptions for upsert decisions either (decided July 2026): no
company has anywhere near 10k records, so bulk-SELECT each table's existing correlation ids
for the company up front, hold them in in-memory sets/maps, split incoming records into
update vs insert lists in code, and write with bulk statements (bulk inserts as today;
updates batched, e.g. the CASE-per-id pattern import_clients already uses for the
default_project_address_id fix-up).

ArboStar ids are assumed unique only per ArboStar tenant, so every unique key below includes
`company_id`. All columns nullable, since rows created in-app have no ArboStar identity.

## Durable correlation, table by table

| Table | Correlation | Notes |
| --- | --- | --- |
| `employee` | new `arbostar_user_id` column, unique `(company_id, arbostar_user_id)` | the existing name-match path (`import_employees.ts`) should backfill `arbostar_user_id` onto the matched row so name-matching only ever happens once |
| `project` | new user-facing `number` column, unique `(company_id, number)`, populated from the integer parsed out of `lead_no` | doubles as the app's own project number; see "Project numbers" below |
| `client` | new `arbostar_client_id` column, unique `(company_id, arbostar_client_id)` | the most load-bearing correlation — addresses, contacts, projects, and payments all resolve through it |
| `payment` | new `arbostar_invoice_id` column, unique `(company_id, arbostar_invoice_id)` | payments are synthesized from paid invoices; `amount_paid` grows between exports, so updates matter most here (unpaid → paid becomes a new insert; partially → more paid becomes an update) |
| `client_contact` | new `arbostar_contact_id` column (ArboStar `cc_id`), unique `(company_id, arbostar_contact_id)` | update-or-insert; contacts absent from the export are only counted, never deleted (decided July 2026 — deletion was too dangerous against partial exports) |
| `project_line_item` | new `arbostar_line_item_id` column (ArboStar `line_item_id`), unique `(company_id, arbostar_line_item_id)` | update-or-insert; then delete rows whose `arbostar_line_item_id` is set but missing from the export — stale line items would inflate project totals (totals derive from line items) — scoped to projects present in the current run so absent leads keep their lines. In-app rows (null arbostar id) are never touched |
| `item_type` | none — natural key `(company_id, name)` (the service name) | re-run must SELECT existing item types by name and reuse them. **Latent bug today**: even a first re-run duplicates every item type |
| `client_address` (primary) | none — reachable via `client.default_project_address_id` once the client is correlated | update in place. A secondary address (none exist to date) also needs no id: ArboStar allows at most one per client, so "this client's `Secondary` row" is a complete natural key |
| `payment_project` | none — natural key `(payment_id, project_id)` (each synthesized payment has at most one project row) | update the amount in place |

No delete-and-reinsert anywhere (decided July 2026) — every child table either has an
ArboStar id or a complete natural key. ArboStar-side deletions are handled by the targeted
"mapped but missing from this export" deletes noted above.

## Project numbers

- `lead_no` / `estimate_no` / `workorder_no` / `invoice_no` all share one integer per lead,
  suffixed with a letter for the stage (`123-L`, `123-E`, `123-W`, `123-I`, plus a handful of
  re-issued invoices shaped `123-I-2`). Verified against the June 2026 export: all 1850 leads
  have a non-null, distinct `lead_no` (integers 1–1909), and **every** estimate (1684),
  workorder (836), and invoice (826) number's integer prefix matches its lead's — zero
  mismatches. So: parse with a regex, assert non-null / parseable.
- The schema already has the allocator: `project_number` (one row per company,
  `last_number INT UNSIGNED`, unique on `company_id`, "incremented atomically when assigning
  project numbers") — but `project` has no `number` column yet, the table has **zero rows**
  (nothing seeds it, not even `create_company`), and nothing reads it. The app's only project
  insert site is `worker/server_functions/lead.fns.ts` (`insert_helper.insert(…, 'project', …)`).
- Plan (done, migration 0016): add `project.number` (NOT NULL): backfill existing projects
  per company ordered by `project_id`, seed a `project_number` row per company + on company
  creation, make `lead.fns.ts` atomically take a number, and have the import write the parsed
  `lead_no` integer.
- Renamed `last_number` → `next_number` (migration 0028; DEFAULT 1, `lead.fns.ts` takes
  `next_number` via `LAST_INSERT_ID(next_number) + 1`). Before writing any projects, the
  import raises the allocator to `GREATEST(next_number, max ArboStar number + 1000)` —
  computed over **all** leads in the export (a lead skipped for having no client still burned
  its number), so an in-app lead created mid-import or between exports can't collide with an
  imported number. The 1000 gap only has to cover ArboStar's new leads between two
  consecutive imports; GREATEST means a re-import never moves the allocator backwards.
  Decided 2026-07-23 (notes.md item 9): numbers are client-facing and must match ArboStar,
  so `number` stays the correlation key — accepted that projects created in-app *before* the
  first import can collide with imported numbers (rely on importing first), and that
  import-created rows are indistinguishable from in-app rows (an `arbostar_lead_id` marker
  column can be added later if that ever bites).

## Employee identity collisions (cross-company)

`employee.email` and `employee.login_name` are unique across the whole table (migration
0015). Correlation by `arbostar_user_id` makes re-imports update rather than collide, but a
genuinely different person in another company with the same login/email is still a real
conflict. Detect it up front like everything else (no `ER_DUP_ENTRY` handling): the keys are
global, so bulk-SELECT the incoming emails/login_names across the whole employee table,
excluding rows already correlated to this company. Colliding users get their identity
downgraded before insert — `login_name` nulled, email replaced with the synthesized
`arbostar.user.{user_id}@import.invalid` — and reported for a human to resolve. Imported
employees can't log in anyway (empty `password_hash`).

## Update semantics

- ArboStar is the source of truth during the migration window: updates blindly overwrite the
  local row, including any local edits. Re-import is therefore only safe before the company
  starts working in this system for real.
- Deletes of top-level entities (employees, clients, projects, payments) are ignored: an
  entity removed in ArboStar just lingers locally — log a count of mapped local rows the new
  export no longer mentions. Line items get the targeted delete-missing pass described above
  (scoped to this run's projects); contacts are counted but never deleted.
- Transactions (decided July 2026): the whole-run transaction stays **until** every importer
  is update-or-insert — today a mid-run crash without it leaves rows a re-run can't recognize
  (correlation columns null → duplicates). Once conversion is complete, replace it with
  **per-importer transactions**: re-runnability becomes the recovery mechanism for a crash
  between phases, lock windows shrink (notably the *global* employee email/login_name unique
  indexes, where a long transaction could stall other companies), and the client → address
  `default_project_address_id = 0` fix-up window is never observable half-done. A single
  connection remains fine — phases are sequential and volumes are seconds-long; per-phase
  transactions are also the natural boundary if pooled parallelism is ever wanted.

## Implementation order

1. ~~Migration~~ **DONE (July 2026, migration 0016)**: `project.number` NOT NULL + unique
   `(company_id, number)` with backfill and `project_number` seeding, plus nullable
   `employee.arbostar_user_id`, `client.arbostar_client_id`, `payment.arbostar_invoice_id`,
   `client_contact.arbostar_contact_id`, `project_line_item.arbostar_line_item_id`, each
   unique with `company_id`. Schema regenerated; validators updated; `create_company` seeds
   `project_number`; `lead.fns.ts` allocates via
   `UPDATE project_number SET last_number = LAST_INSERT_ID(last_number + 1)`. The session
   user type (`worker/lib/context.ts`) and in-app employee-creation args deliberately omit
   `arbostar_user_id`. `import_projects.ts` already writes `number` (parsed `lead_no`) and
   bumps `last_number` after insert, so a plain first import works against the new schema.
2. ~~Correlation priming~~ **DONE (July 2026)**:
   `shared/arbostar/load_existing_correlations.ts` bulk-SELECTs the company's correlations
   (five arbostar_* columns, `project.number`, `item_type` by name, and each correlated
   client's `default_project_address_id`) into `Map<number, bigint>`s. Exposed to the
   importers as `context.existing` on `ArbostarImportContext`, populated by
   `shared/arbostar/resolve_context.ts` — which the orchestrator calls itself (it takes a
   pool + company_id; its four lookups run in parallel on pooled connections). The node
   script is only environment glue: env vars, CLI args, data files, console output.
3. ~~import_employees~~ **DONE**: split correlated / identity-matched / name-matched (both
   matches backfill the correlation) / new; updates touch only name + phone +
   arbostar_user_id. **Identity columns are insert-only** (decided during implementation):
   email/login_name are login credentials, so re-imports never overwrite them — which also
   means collision handling only applies to inserts (checked up front against every identity
   in the table, downgraded on collision). Writes use `insert_helper.bulk_update` (generic
   CASE-per-key batched UPDATE, added to typed_insert_helper.ts). Later decisions (July
   2026): only active (`'yes'`) ArboStar accounts import — suspended/inactive are ignored on
   every run; `is_owner` is in-app-managed — inserted false, never updated; identity matching
   (ArboStar emailid/personal_email/user_email vs the company's employee login_name/email)
   runs before name matching so a pre-created in-app account adopts its ArboStar user.
4. ~~Other importers~~ **DONE**, per the table above. Only ArboStar-derived columns are
   updated; locally-populated ones (project due_date/emergency/notes_for_crew/closed
   dates/created_by, client billing/tax/referred_by, payment method/status) are never
   touched after insert. (Project taxable/tax_rate_id/tax_rate became ArboStar-derived in
   July 2026 — implied from invoice tax amounts and snapped to the official taxes.js list —
   so re-imports do overwrite them.) `project.closed` is a one-way ratchet on updates: the import can
   set it but never clears it, so a re-run can't reopen a project closed in-app.
5. ~~Finish-up~~ **DONE**: `*_no_longer_in_export` counts in the summary (the project one
   also counts in-app-allocated numbers — flag, not exact); per-importer transactions in the
   orchestrator, no whole-run transaction in the script.

## Findings from the live test

- ArboStar's estimate editor payload reuses line-item ids: 13 ids appear twice in the June
  2026 export (one real row + one phantom with null service/price/quantity on an unrelated
  newer lead). `import_line_items` dedupes by keeping the copy with the most data
  (`duplicate_line_items_dropped`).
- The mid-run failure that surfaced that bug doubled as a live test of crash recovery:
  employees/clients/projects had committed, line items rolled back, and the re-run updated
  the committed phases and inserted the rest. Exactly the designed behavior.

## Open items

- `clients.js` on disk predates the raw-export rework, so it has no nested contacts —
  contacts import as zero until `export_clients.ts` is re-run with a live ArboStar session.
- Distribution: the import runs as a local script over a connection pool — the orchestrator
  takes a `Pool`, each phase runs in `pool_transaction` (own connection, own transaction; see
  `worker/lib/mysql/helpers.ts`), and independent phases run concurrently:
  (employees ∥ clients) → projects → (line items ∥ payments). That's the maximum the data
  dependencies allow — projects consume the client ids, line items/payments consume the
  project ids. Running it in prod (upload + import per client company) still needs a home.

## Test company

Local dev use `company_id 9` (created July 2026), for exercising the
import. Test with `dotenv -- node scripts/import_arbostar_export.ts --company_id 9`.

## Related decisions already made

- Exports are raw ArboStar rows now, not curated mappings. `addresses.js` and `contacts.js`
  are gone (July 2026): `clients.js` is the raw `/clients` datatable rows with `contacts[]`
  and `address_related` nested. **A pre-July-2026 `clients.js` has no `contacts` — re-run
  `export_clients.ts` before the next import or contacts import as zero.**
- Secondary addresses aren't imported (no client in the account has ever had one; the
  profile-only fetch was deleted with `export_addresses.ts`).
