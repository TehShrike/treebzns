---
name: create-server-function
description: Create or change a server function (typed RPC endpoint) in src/worker/server_functions. Use when the client needs a new API endpoint, or when an existing *.fns.ts function needs new behavior.
---

# Create a server function

A server function is a typed RPC. The worker serves it at `POST /api/fn/<name>`. The client calls it as `server.<name>(arg)` through the client context. Codegen keeps the two sides in sync, so most of the work is writing one `*.fns.ts` entry well.

Function names share one flat namespace across all `*.fns.ts` files. Routing uses the name alone. Keep every name unique.

## Where things live

- Endpoint definitions: `src/worker/server_functions/<domain>.fns.ts`
- Helpers used by one domain: a sibling directory, like `src/worker/server_functions/lead_helper/`
- Helpers reusable across domains: `#worker/lib/db/`
- Argument object types shared with the client: `#shared/type/`
- Generated worker registry (do not edit): `src/worker/server_functions.generated.ts`
- Generated client caller (do not edit): `src/client/lib/server_functions.ts`

## Steps

### 1. Define the endpoint

Add an entry to the `functions` export, wrapped in `sfn` from `#worker/lib/server_functions_api.ts`:

```ts
export const functions = {
	create_lead: sfn({
		validator: create_lead_validator,
		fn: (
			{ client, address, project },
			{ company, user, select_builder, write_helper, transaction },
		) => transaction(async () => {
			...
			return { project_id, client_id }
		}),
	}),
}
```

Destructure the argument and the context in the parameter list. The context provides `user`, `company`, `select_builder` (tenanted query builder), `write_helper`, and `transaction`.

### 2. Write the validator

Use `jv` from `#shared/json_validator.ts`. Temporal validators come from `#schema/validator/_helpers.ts`.

- Group related fields into sub-objects (`client`, `address`, `project`). Do not accept one flat bag of fields.
- Model mutually exclusive fields as a discriminated union: put the shared field validators in a plain object, then spread it into each `jv.one_of` branch.
- Name fields for what they are. One name for one thing (`billing_address`, not `billing`).

### 3. Write the body

- Wrap the body in `transaction(...)` when it performs more than one write.
- Validate every id the client sent before any write. Use `assert_db_id_valid` from `#worker/lib/db/assert_db_id_valid.ts`. Batch the checks in one `Promise.all`, with `field !== null &&` guards for nullable ids. Put them in one `assert_input_ids_valid` helper.
- Read with `select_builder`. Write with `write_helper.insert`, `write_helper.update`, and `write_helper.bulk_insert` (use `bulk_insert` for arrays).
- Assert business assumptions with `assert` from `#shared/assert.ts`. The message states the thing asserted, not an error ("client_address_id is null when the client is new").
- Return a typed object. The client gets this type through codegen, so it must not resolve to `any`.
- Use the array functions from `#shared/array.ts`, not built-ins.

### 4. Extract helpers

The `sfn` body is orchestration. It names each step and holds the branching. If there is more than one query, the DB work lives in helpers:

- Each helper takes one object parameter.
- Each helper declares only what it needs, with narrow types: `company_id: bigint`, `write_helper: ConnectionBoundWriteHelper` (from `#worker/lib/mysql/write_helper.ts`), `select_builder: TenantedSelectBuilder` (from `#worker/lib/db/make_tenanted_select_builder.ts`). Do not pass the whole `Context` or the whole `company` object.
- An insert-or-update pair becomes two private functions plus one exported `upsert_x` that branches on the null id.
- If the file is more than ~250 lines, move helpers specific to the domain to the sibling `<domain>_helper/` directory. Helpers other domains could use go in `#worker/lib/db/`.

### 5. Regenerate

Two scripts pick up the new function:

- `pnpm run build:glob:server_functions` regenerates the worker registry.
- `pnpm run build:server_function_types` regenerates the typed client caller. It fails when an argument or return type resolves to `any` — fix the types, do not weaken them.

The dev watcher (`dev:glob:server_functions`) runs both on save, so skip this step when the dev server is running.

If the generated client file references a named type by its bare name, the generator must import it. It only searches the modules listed in `type_source_modules` in `scripts/generate_server_function_types.ts`. Add your shared type module to that list when a new one appears in the output.

### 6. Verify

Run `pnpm run test:types`. It checks the worker, the client, and the regenerated `src/client/lib/server_functions.ts` together.

On the client, call the function as `server.<name>(arg)`. Only real server functions belong on the `server` object.
