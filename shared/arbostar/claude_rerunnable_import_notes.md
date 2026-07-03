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
table — only four tables need correlation (decided against a mapping table).

ArboStar ids are assumed unique only per ArboStar tenant, so every unique key below includes
`company_id`. All columns nullable, since rows created in-app have no ArboStar identity.

## Durable correlation, table by table

| Table | Correlation | Notes |
| --- | --- | --- |
| `employee` | new `arbostar_user_id` column, unique `(company_id, arbostar_user_id)` | the existing name-match path (`import_employees.ts`) should backfill `arbostar_user_id` onto the matched row so name-matching only ever happens once |
| `project` | new user-facing `number` column, unique `(company_id, number)`, populated from the integer parsed out of `lead_no` | doubles as the app's own project number; see "Project numbers" below |
| `client` | new `arbostar_client_id` column, unique `(company_id, arbostar_client_id)` | the most load-bearing correlation — addresses, contacts, projects, and payments all resolve through it |
| `payment` | new `arbostar_invoice_id` column, unique `(company_id, arbostar_invoice_id)` | payments are synthesized from paid invoices; `amount_paid` grows between exports, so updates matter most here (unpaid → paid becomes a new insert; partially → more paid becomes an update) |
| `item_type` | none — natural key `(company_id, name)` (the service name) | re-run must SELECT existing item types by name and reuse them. **Latent bug today**: even a first re-run duplicates every item type |
| `client_address` (primary) | none — reachable via `client.primary_client_address_id` once the client is correlated | update in place |
| `client_contact` | none — delete-and-reinsert per client | nothing in the schema references contact rows; ArboStar's `cc_id` exists if that ever changes |
| `project_line_item` | none — delete-and-reinsert per project | nothing references line-item rows; ArboStar's `line_item_id` exists if that ever changes |
| `payment_project` | none — rewritten alongside its payment | identified by `(payment_id, project_id)` |

## Project numbers

- `lead_no` / `estimate_no` / `workorder_no` / `invoice_no` all share one integer per lead,
  suffixed with a letter for the stage (`123-L`, `123-E`, `123-W`, `123-I`, plus a handful of
  re-issued invoices shaped `123-I-2`). Verified against the June 2026 export: all 1850 leads
  have a non-null, distinct `lead_no` (integers 1–1909), and **every** estimate (1684),
  workorder (836), and invoice (826) number's integer prefix matches its lead's — zero
  mismatches. So: parse with a regex, assert non-null / parseable.
- The schema already has the allocator: `project_number` (one row per company,
  `last_number INT UNSIGNED`, unique on `company_id`, "incremented atomically when assigning
  project numbers") — but `project` has no `number` column yet and nothing uses the table.
- Plan: add `project.number`, populate from the parsed `lead_no` integer on import, and after
  each import bump the company's `project_number.last_number` to at least the max imported
  number so in-app projects continue the sequence.

## Employee identity collisions (cross-company)

`employee.email` and `employee.login_name` are unique across the whole table (migration
0015). Correlation by `arbostar_user_id` makes re-imports update rather than collide, but a
genuinely different person in another company with the same login/email is still a real
conflict. Plan: `import_employees.ts` now inserts one row at a time
(`arbostar_user_to_employee_row` + per-row `insert_helper.insert`), so catch `ER_DUP_ENTRY`
there and retry with the identity downgraded — `login_name` nulled, email replaced with the
synthesized `arbostar.user.{user_id}@import.invalid` — and report it for a human to resolve.
Imported employees can't log in anyway (empty `password_hash`).

## Update semantics

- ArboStar is the source of truth during the migration window: updates blindly overwrite the
  local row, including any local edits. Re-import is therefore only safe before the company
  starts working in this system for real.
- Deletes are ignored: an entity removed in ArboStar just lingers locally. Log a count of
  mapped local rows the new export no longer mentions.
- The whole run stays one transaction.

## Implementation order

1. Migration: `project.number` + unique key, `employee.arbostar_user_id` + unique key,
   `client.arbostar_client_id` + unique key, `payment.arbostar_invoice_id` + unique key
   (+ regenerate schema types/validators).
2. Orchestrator: load existing correlations for the company into the same
   `Map<arbostar_id, local_id>` shapes the importers already use (first import = empty maps).
3. Convert `import_employees.ts` to update-or-insert + `ER_DUP_ENTRY` downgrade — the
   template for the rest.
4. `import_clients.ts` (client update-or-insert, primary address update via pointer,
   contacts delete-and-reinsert), `import_projects.ts` (number parsing + update-or-insert),
   `import_line_items.ts` (item_type reuse by name, line items delete-and-reinsert per
   project), `import_payments.ts` (update-or-insert by `arbostar_invoice_id`,
   `payment_project` rewrite).
5. Bump `project_number.last_number`; log unmatched-mapping counts.

## Related decisions already made

- Exports are raw ArboStar rows now, not curated mappings. `addresses.js` and `contacts.js`
  are gone (July 2026): `clients.js` is the raw `/clients` datatable rows with `contacts[]`
  and `address_related` nested. **A pre-July-2026 `clients.js` has no `contacts` — re-run
  `export_clients.ts` before the next import or contacts import as zero.**
- Secondary addresses aren't imported (no client in the account has ever had one; the
  profile-only fetch was deleted with `export_addresses.ts`).
