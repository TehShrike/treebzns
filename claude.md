Don't add comments unless something truly exceptional is happening that can't be inferred from the code.  Comments are shameful.

When possible, use the functions in #shared/array.ts rather than built-in array functions or for of loop.  The ones in shared/array are more performant.

Assertion messages should say the thing that they are asserting, they should not be phrased as error messages.

Never apply schema changes to the database by hand with the mysql cli.  To run new migrations in local dev, use `pnpm run local:db_up` — it validates migration numbering (e.g. duplicate numbers), applies pending migrations, records them in the `migration` table, and regenerates the exported schema, so problems surface before committing.  The mysql cli (credentials in the .env file) is fine for inspecting data, but not for DDL.

To check the type of a specific type or variable in a file, use tsserver directly, e.g.

```
echo '{"seq":1,"type":"request","command":"open","arguments":{"file":"myfile.ts"}}
{"seq":2,"type":"request","command":"quickinfo","arguments":{"file":"myfile.ts","line":5,"offset":10}}' | npx tsserver
```

This project uses pnpm.

Avoid importing from directories using ../ if it is possible to use a #dir/ import map path instead.

`pnpm run test` to run automated tests and all type checks.  `pnpm run test:types` to check all types.

## Svelte

If you need documentation for anything related to Svelte, invoke the svelte MCP `list-sections` tool to see the available sections, then `get-documentation` for the relevant paths. Before reaching for `get-documentation`, try to answer from your own knowledge and the `svelte-autofixer` tool — documentation sections are token-intensive.

Every time you write a Svelte component or a Svelte module you MUST invoke the `svelte-autofixer` tool providing the code. The tool will return a list of issues or suggestions. If there are any issues or suggestions you MUST fix them and call the tool again with the updated code. You MUST keep doing this until the tool returns no issues or suggestions. Only then you can return the code to the user.

## ASR (abstract-state-router)

- all `asr` properties are reset when the state changes, so all `asr` methods used inside of Svelte components are reactive even though they appear not to be

## SQL queries

Use the typed_query_builder for all SELECT queries.

## Exporting Arbostar client data

Client domain names, session information, and data must never be committed to git.  They may be exported to gitignored files, to /tmp, and imported to mysql.
