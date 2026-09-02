Don't add comments unless something truly exceptional is happening that can't be inferred from the code.  Comments are shameful.

When possible, use the functions in #shared/array.ts rather than built-in array functions or for of loop.  The ones in shared/array are more performant.

CSS layout is the parent's job.  Never use self-placement properties (align-self, justify-self, place-self) on children — parents define how their children are laid out (display, flex-direction, align-items, justify-items, gap).  A child may size itself (e.g. width: fit-content) but not place itself.

Assertion messages should say the thing that they are asserting, they should not be phrased as error messages.

Never round or change the precision of a number with toFixed or float arithmetic.  Coerce the number to a string, wrap it with financial-number (#shared/fnum.ts), and use changeDecimalPlaces/toString.  For numbers that come from ArboStar, use #shared/arbostar/arbostar_number_to_fnum.ts — it also strips ArboStar's float noise.

To learn the current database schema, read schema/current_schema.sql.  Do not scan the migration files.  The export scripts regenerate that file from the live database.

Never apply schema changes to the database by hand with the mysql cli.  To run new migrations in local dev, use `pnpm run local:db_up` — it validates migration numbering (e.g. duplicate numbers), applies pending migrations, records them in the `migration` table, and regenerates the exported schema, so problems surface before committing.  The mysql cli (credentials in the .env file) is fine for inspecting data, but not for DDL.

To check the type of a specific type or variable in a file, use tsserver directly, e.g.

```
echo '{"seq":1,"type":"request","command":"open","arguments":{"file":"myfile.ts"}}
{"seq":2,"type":"request","command":"quickinfo","arguments":{"file":"myfile.ts","line":5,"offset":10}}' | npx tsserver
```

This project uses pnpm, nvm, and corepack.

Avoid importing from directories using ../ if it is possible to use a #dir/ import map path instead.

`pnpm run test` to run automated tests and all type checks.  `pnpm run test:types` to check all types.

## Writing style (Simplified Technical English)

Apply this to all prose you write: conversation replies, docs, PR text, commit messages, error messages, code comments.  It does not apply to code, identifiers, or command syntax.  For a full rewrite of existing text, invoke the ste-writing skill.

- Active voice.  Keep sentences under about 20 words.  One instruction per sentence.
- Use the short common word: use (not utilize/leverage), start (not initiate), make sure (not ensure), before (not prior to), about (not regarding), also (not additionally/furthermore).
- Use one name for one thing.  Do not call the same item by two different names.
- Use a verb for an action: "analyze the log", not "perform an analysis of the log".  No phrasal verbs ("spin up"), no stacked hedges ("it is important to note that this may help to").
- No marketing adjectives: seamless, robust, powerful, effortless, cutting-edge.
- No semicolons.  Write two sentences.

## Svelte

If you need documentation for anything related to Svelte, invoke the svelte MCP `list-sections` tool to see the available sections, then `get-documentation` for the relevant paths. Before reaching for `get-documentation`, try to answer from your own knowledge and the `svelte-autofixer` tool — documentation sections are token-intensive.

Every time you write a Svelte component or a Svelte module you MUST invoke the `svelte-autofixer` tool providing the code. The tool will return a list of issues or suggestions. If there are any issues or suggestions you MUST fix them and call the tool again with the updated code. You MUST keep doing this until the tool returns no issues or suggestions. Only then you can return the code to the user.

## ASR (abstract-state-router)

- all `asr` properties are reset when the state changes, so all `asr` methods used inside of Svelte components are reactive even though they appear not to be

## In-page comments addressed to Claude

The dev-only tool in src/client/dev_claude_code_comment/ lets the developer option-click any element in the running app and leave a comment for Claude.  Saving a comment sets `data-claude-comment="<text>"` on the clicked element and inserts an HTML comment node ` claude: <text> ` directly above it.

When asked to address comments, use the Chrome MCP tools.  Check `tabs_context_mcp` for an existing tab on localhost:8787; if there is none, create a tab and navigate it to http://localhost:8787/app (log in is via cookie, already set in the browser).  Collect comments with javascript_tool: `[...document.querySelectorAll('[data-claude-comment]')]`, gathering each element's comment plus identifying context (tag, classes, text content, ancestor chain — the extension may redact full outerHTML).  Use that context to locate the matching component under src/client/route/ or src/client/component/.  Comments exist only in the live DOM, so collect them before changing code, reloading, or navigating the tab.

## SQL queries

Use the typed_query_builder for all SELECT queries.

## _history tables

Some tables have a companion `_history` table (e.g. `project` → `project_document_history`).  Code that inserts into the main table must also insert the initial `_history` row.  Code that changes the tracked value must insert a `_history` row for the change.
Every `_history` row carries `change_date` (the company-local calendar day) and `change_datetime` (the UTC instant).  Neither has a default, so every writer supplies both from the same instant.

## company_id in indexes

Every tenant-scoped table has a company_id column.  Every query filters on it for permission scoping.  That does not mean indexes need it.

Do not put company_id in front of a globally-unique id column (any *_id that is an AUTO_INCREMENT primary key in its own table).  All rows that match one id value already belong to one company.  The prefix filters nothing and only makes the index larger.  Index the id alone.  The `WHERE company_id = ?` clause still runs as a cheap check on the fetched rows.

Lead with company_id only when the next column's values are shared across companies:

- User-entered values in unique keys: names, titles, emails (e.g. `uq_line_item_template_company_title`).
- Dates and flags (e.g. `idx_time_entry_company_work_date`, `idx_project_company_closed`).
- Global codebook ids.  `project_document` and `permission` have no company_id, so their ids repeat across companies (e.g. `idx_project_company_document`).
- NULL.  NULL values span companies.  A nullable column queried with `IS NULL` per company needs the prefix (e.g. `idx_project_company_estimator` for "unassigned projects").

A bare `(company_id)` index is only for "load all rows for the company" on catalog tables.  It is redundant when the table has a `(company_id, ...)` unique key.  Also skip an index when an existing unique key starts with the same columns.

## Exporting Arbostar client data

Client domain names, session information, and data must never be committed to git.  They may be exported to gitignored files, to /tmp, and imported to mysql.

To dump one company's rows (every table with a company_id column) into the gitignored company_inserts.sql at the repo root, run `pnpm exec dotenv -- node scripts/dump_company_inserts.ts --company_id <id>`.  The file deletes the company's rows per table and re-inserts them, capped at 100 rows per INSERT.
