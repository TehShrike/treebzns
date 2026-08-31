---
name: arbostar-export-import
description: Refresh the ArboStar session, re-run the export scripts, and import the data into the local database. Use when the user provides fresh ArboStar cookies or asks to re-sync ArboStar data.
---

# Export from ArboStar and import to the local database

The export scripts pull data from the client's ArboStar account into gitignored `arbostar_export/*.js` files. The import script loads those files into the local MySQL database. Full endpoint details live in `scripts/arbostar/readme.md`. Output details live in `arbostar_export/readme.md`.

Never commit client domain names, session values, or exported data. The session file and the `arbostar_export/*.js` files are gitignored for this reason.

## 1. Update the session

Credentials live in `scripts/arbostar/.arbostar_session.json` (gitignored). The user usually pastes a "Copy as cURL" command from DevTools. Lift these values from it:

- `base_url` — the account origin (the URL's scheme + host)
- `headers.cookie` — only `XSRF-TOKEN` and `<subdomain>_session` matter, drop the rest
- `headers.x-csrf-token` — same value as the XSRF-TOKEN cookie
- `headers.x-device-id` and `headers.x-fingerprint` — copy as-is (they rarely change)
- `cookies` — the same two cookies as `{name, value, domain, path}` objects (used by the puppeteer discovery scripts)

The session cookie expires every couple of days. A stale session makes exports throw `request failed: 302`. The tree-inventory set enrichment throws `401` instead.

## 2. Run the exports

Run from the repo root. One script runs everything, in parallel where dependencies allow:

```sh
node scripts/arbostar/export_all.ts
```

Each child script overwrites its `arbostar_export/<name>.js` file, with output prefixed by dataset name. The script exits nonzero and names the failures if any child fails.

Notes:

- The whole run takes as long as `export_line_items.ts` (one ~355 KB editor fetch per estimate, 15+ minutes). Run it in the background and check the output file for progress.
- A stale session fails fast on every child with `request failed: 302`.
- If a script's mapper changed, update the matching committed `arbostar_export/<name>.d.ts`.
- The per-dataset `export_*.ts` scripts still run individually if only one dataset is needed.

## 3. Import into the local database

The import is an update-or-insert keyed on the `arbostar_*_id` unique keys, so re-runs are safe. It needs `line_items.js`, so wait for the background export to finish.

Find the company id (the company that holds the imported ArboStar data — it has by far the most clients):

```sh
pnpm exec dotenv -- sh -c 'mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "SELECT company_id, COUNT(*) FROM client GROUP BY company_id"'
```

Then run the import (company_id 9 as of August 2026):

```sh
pnpm exec dotenv -- node scripts/import_arbostar_export.ts --company_id <id>
```

It prints a per-entity summary of inserted and updated counts. Report that summary to the user.

## 4. Verify

Spot-check a few row counts against the export sizes, for example:

```sh
pnpm exec dotenv -- sh -c 'mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "SELECT COUNT(*) FROM client WHERE company_id = <id>; SELECT COUNT(*) FROM invoice WHERE company_id = <id>"'
```

Counts will not match the exports exactly. The import curates rows (see `src/shared/arbostar/arbostar_import_notes.md`), and the summary output is the source of truth.

## 5. Refresh the SQL dump

After the import, regenerate the gitignored `company_inserts.sql` at the repo root:

```sh
pnpm exec dotenv -- node scripts/dump_company_inserts.ts --company_id <id>
```

It dumps the company's rows from every table with a company_id column, with a DELETE per table before the inserts. Replaying the file needs SUPER for its `SET GLOBAL max_allowed_packet` line. Without that privilege, skip the line: `grep -v "^SET GLOBAL" company_inserts.sql | mysql ...`.
