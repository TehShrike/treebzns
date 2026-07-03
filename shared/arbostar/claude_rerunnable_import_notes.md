# Re-runnable ArboStar import — working notes

Goal: `scripts/import_arbostar_export.ts` should be safe to run repeatedly for the same
company — first run inserts, later runs update rows that already exist and insert new ones.
Today the import is **not idempotent** (running it twice doubles every row) and re-importing
the same users fails on the globally unique `employee.email` / `employee.login_name` keys.

Status: planning/discussion done (July 2026), implementation not started. This file is the
plan of record — update it as decisions change or steps land.

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
primary_client_address_id fix-up).

ArboStar ids are assumed unique only per ArboStar tenant, so every unique key below includes
`company_id`. All columns nullable, since rows created in-app have no ArboStar identity.

## Durable correlation, table by table

| Table | Correlation | Notes |
| --- | --- | --- |
| `employee` | new `arbostar_user_id` column, unique `(company_id, arbostar_user_id)` | the existing name-match path (`import_employees.ts`) should backfill `arbostar_user_id` onto the matched row so name-matching only ever happens once |
| `project` | new user-facing `number` column, unique `(company_id, number)`, populated from the integer parsed out of `lead_no` | doubles as the app's own project number; see "Project numbers" below |
| `client` | new `arbostar_client_id` column, unique `(company_id, arbostar_client_id)` | the most load-bearing correlation — addresses, contacts, projects, and payments all resolve through it |
| `payment` | new `arbostar_invoice_id` column, unique `(company_id, arbostar_invoice_id)` | payments are synthesized from paid invoices; `amount_paid` grows between exports, so updates matter most here (unpaid → paid becomes a new insert; partially → more paid becomes an update) |
| `client_contact` | new `arbostar_contact_id` column (ArboStar `cc_id`), unique `(company_id, arbostar_contact_id)` | update-or-insert; after upserting a client's contacts, delete rows whose `arbostar_contact_id` is set but absent from the export |
| `project_line_item` | new `arbostar_line_item_id` column (ArboStar `line_item_id`), unique `(company_id, arbostar_line_item_id)` | update-or-insert; then delete rows whose `arbostar_line_item_id` is set but missing from the export — stale line items would inflate project totals (totals derive from line items). In-app rows (null arbostar id) are never touched |
| `item_type` | none — natural key `(company_id, name)` (the service name) | re-run must SELECT existing item types by name and reuse them. **Latent bug today**: even a first re-run duplicates every item type |
| `client_address` (primary) | none — reachable via `client.primary_client_address_id` once the client is correlated | update in place. A secondary address (none exist to date) also needs no id: ArboStar allows at most one per client, so "this client's `Secondary` row" is a complete natural key |
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
- Plan: add `project.number` (NOT NULL): backfill existing projects per company ordered by
  `project_id`, seed a `project_number` row per company + on company creation, make
  `lead.fns.ts` atomically bump `last_number` and use it, and have the import write the parsed
  `lead_no` integer. After each import bump the company's `last_number` to at least the max
  imported number so in-app allocation never collides.

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
  export no longer mentions. Child rows (contacts, line items) DO get the targeted
  delete-missing pass described above.
- The whole run stays one transaction.

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
2. Orchestrator: bulk-SELECT existing correlations for the company into the same
   `Map<arbostar_id, local_id>` shapes the importers already use (first import = empty maps).
3. Convert `import_employees.ts` to split-then-bulk-write update-or-insert, with the up-front
   global email/login_name collision query and identity downgrade — the template for the rest.
4. `import_clients.ts` (client update-or-insert, primary address update via pointer,
   contacts update-or-insert by `arbostar_contact_id` + delete-missing),
   `import_projects.ts` (number parsing + update-or-insert),
   `import_line_items.ts` (item_type reuse by name, line items update-or-insert by
   `arbostar_line_item_id` + delete-missing), `import_payments.ts` (update-or-insert by
   `arbostar_invoice_id`, `payment_project` amount update in place).
5. Bump `project_number.last_number`; log unmatched-mapping counts.

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
