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

## css

When you need styles based on dynamic state, prefer data attributes rather than classes.

## Writing style

Apply this to all prose you write.

- Use one name for one thing. Do not call the same item by two different names.
- Use the short common word: start (not begin/commence/initiate), use (not utilize/leverage), help (not facilitate), make sure (not ensure), before (not prior to), after (not subsequent to), about (not regarding/concerning), get (not obtain/acquire), show (not demonstrate), also (not additionally/furthermore/moreover).
- Give each word one meaning. "fall" means to move down, not to decrease.
- No marketing adjectives: seamless, robust, powerful, cutting-edge, effortless, world-class, next-generation, revolutionary.
- American spelling.
- Any sentence over 20 words? Split it.
- Any semicolon? Replace with a period.
- Any contraction? Expand it.
- Any passive voice with a known actor? Make it active.
- Any "-ing" main verb, nominalization ("perform an analysis"), or phrasal verb ("spin up")? Replace with a plain verb.
- Same thing named two ways? Pick one name.

## Svelte

If you need documentation for anything related to Svelte, invoke the svelte MCP `list-sections` tool to see the available sections, then `get-documentation` for the relevant paths. Before reaching for `get-documentation`, try to answer from your own knowledge and the `svelte-autofixer` tool — documentation sections are token-intensive.

Every time you write a Svelte component or a Svelte module you MUST invoke the `svelte-autofixer` tool providing the code. The tool will return a list of issues or suggestions. If there are any issues or suggestions you MUST fix them and call the tool again with the updated code. You MUST keep doing this until the tool returns no issues or suggestions. Only then you can return the code to the user.

## ASR (abstract-state-router)

- all `asr` properties are reset when the state changes, so all `asr` methods used inside of Svelte components are reactive even though they appear not to be

## SQL queries

Use the typed_query_builder for all SELECT queries.

## _history tables

Some tables have a companion `_history` table (e.g. `project` → `project_document_history`).  Code that inserts into the main table must also insert the initial `_history` row.  Code that changes the tracked value must insert a `_history` row for the change.
Every `_history` row carries `change_date` (the company-local calendar day) and `change_datetime` (the UTC instant).  Neither has a default, so every writer supplies both from the same instant.

## Exporting Arbostar client data

Client domain names, session information, and data must never be committed to git.  They may be exported to gitignored files, to /tmp, and imported to mysql.

To dump one company's rows (every table with a company_id column) into the gitignored company_inserts.sql at the repo root, run `pnpm exec dotenv -- node scripts/dump_company_inserts.ts --company_id <id>`.  The file deletes the company's rows per table and re-inserts them, capped at 100 rows per INSERT.
