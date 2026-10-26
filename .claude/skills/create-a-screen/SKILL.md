---
name: create-a-screen
description: Create or restructure a client screen (a *.State.svelte route under src/client/route) and its form components. Use when adding a new page, a new form that calls a server function, or when splitting a screen into child components. Covers state shape, bindings, validation, naming, and verification.
---

# Create a screen

A screen is a `*.State.svelte` file under `src/client/route/`. It registers an abstract-state-router state, resolves its data, and renders the page. A form screen holds one form object whose `start_save()` builds the server function argument. The form object lives in a `<form_name>_form.svelte.ts` module next to the screen.

## Where things live

- Screen: `src/client/route/app/<area>/<screen_name>/<ScreenName>.State.svelte` (areas so far: `menu`, `estimate`)
- The form object: `src/client/route/app/<area>/<screen_name>/<form_name>_form.svelte.ts`
- Records that may already exist in the database: `#lib/tracked_record.svelte.ts`
- Lists of child records the user can add, edit, and remove: `#component/list_input/editable_rows.svelte.ts` for the list, `#lib/tracked_record_array.ts` for what to save
- Select functions that list a whole table or get one record by its primary key: `src/client/lib/generic_queries/<table_name>.ts`, imported as `#lib/generic_queries/<table_name>.ts`. Look there before writing a new one.
- Components used by more than one screen: `src/client/component/`
- Argument types shared with the server: `#shared/type/<domain>.ts`
- Generated state registry (do not edit): `src/client/globbed_states.generated.ts`

## Steps

### 1. Register the state

Put the state definition in the module script. Select reference data in `resolve` with the typed query builder, in one `Promise.all`.

```svelte
<script module lang="ts">
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import { select_tax_rates } from '#lib/generic_queries/tax_rate.ts'
	import { select_employees } from '#lib/generic_queries/employee.ts'

	export const asr_state = state_type({
		name: `app.menu.create_a_lead`,
		route: `/create_a_lead`,
		resolve: async ({ client_cache, query, server }) => {
			const [tax_rates, employees] = await Promise.all([
				select_tax_rates(query),
				select_employees(query),
			])
			return { client_cache, server, tax_rates, employees }
		},
	})

	type Resolved = StateResolve<typeof asr_state>
</script>

<script lang="ts">
	const { client_cache, server, tax_rates, employees, asr }: Resolved & { asr: StateAsr } = $props()
</script>
```

Each query function is a small function named `select_<rows>` that takes `query: ClientQueryFn` and returns plain rows. One that lists a whole table, or gets one record by its primary key, lives in `#lib/generic_queries/<table_name>.ts` so every screen shares it. One with joins or filters that only this screen needs is a module-level function in the screen. The `select_` prefix means the function runs a query. The dev watcher (`dev:glob:states`) regenerates the state registry on save. Run `pnpm run build:glob:states` when the dev server is not running.

### 2. Share the argument types

The server function's validator and the screen use the same types. Put them in `#shared/type/<domain>.ts`, built from the `Db*` table types:

```ts
export type LeadAddress = Pick<DbClientAddress, 'address_line_1' | 'city' | 'zip'> & {
	client_address_id: DbClientAddress['client_address_id'] | null
}
```

A record that the user may pick from the database is a union. A new record carries every value. A pre-existing record carries its id plus only the changed values:

```ts
export type LeadAddressValues = Pick<DbClientAddress, 'address_line_1' | 'city' | 'zip'>
export type LeadAddress =
	| ({ client_address_id: null } & LeadAddressValues)
	| ({ client_address_id: DbClientAddress['client_address_id'] } & Partial<LeadAddressValues>)
```

Validate it with two `jv.one_of` branches that share one object of value validators. `jv.optional_shape` makes every key of the shape optional for the pre-existing branch. The server helper that updates a pre-existing record passes the partial to `write_helper.update` and skips the update when the partial has no fields besides the id.

Type the validator with them (`jv.Validator<{ address: LeadAddress, ... }>`). Regenerate the client caller with `pnpm run build:server_function_types` if the dev server is not running. See the create-server-function skill for the server side.

### 3. Build the form object

The form object is a closure in `<form_name>_form.svelte.ts`. It owns every value the server receives. Its `start_save()` builds the whole argument and returns it with `commit` and `discard`. The screen creates it once and passes its parts to the child components.

```ts
const make_lead_form = () => {
	const client = tracked_record<LeadClientValues, 'client_id'>({
		default_values: pick(default_values.client, [`name`, `billing_phone`, ...]),
		id_key: `client_id`,
	})
	const address = tracked_record<LeadAddressValues, 'client_address_id'>({
		default_values: pick(default_values.client_address, [`address_line_1`, ...]),
		id_key: `client_address_id`,
	})

	const start_save = () => {
		const client_save = client.start_save()
		const address_save = address.start_save()

		const values: CreateLeadArgument = { client: client_save.values, address: address_save.values }

		return {
			values,
			commit: (result: CreateLeadResult) => {
				client_save.commit(result.client_id)
				address_save.commit(result.client_address_id)
			},
			discard: () => {
				client_save.discard()
				address_save.discard()
			},
		}
	}

	return {
		client,
		address,
		start_save,
	}
}
```

- **A record that may already exist is a `tracked_record`.** It takes `default_values`, `id_key`, and `values_in_db` (the row from the database, or omitted for a new record). It exposes `form_values` (what inputs bind to), `values_in_db`, `db_id` (null for a new record), `stable_record_identifier` (a key that stays the same before and after the first save), `needs_to_be_saved`, `is_empty`, `saved_in_database`, and `value_needs_to_be_saved(key)`. `start_save()` returns a pending save. For a new record its `values` is every field with a null id. For a pre-existing record it is the id plus the fields whose form value differs from the database value. Call its `commit(db_id)` after the server answers, or `discard()` when the save fails. `set_values(row)` picks a row and copies its values into the form. `clear()` returns to a new record. Pass `equality_checks` for a value that `===` cannot compare.
- **A list of child records is an `editable_rows` of `tracked_record`s plus a `tracked_record_array`.** Write one `make_<thing>(values_in_db)` function that builds a `tracked_record`. Give `editable_rows` the loaded records as `initial`, `make_empty_row: () => make_<thing>(null)`, `row_is_empty: row => row.is_empty`, and `get_key: row => row.stable_record_identifier`. It owns the trailing placeholder row, cleanup, focus, and removal, and the screen binds `ListInput` to it. Give `tracked_record_array` a getter for the live rows: `records: () => rows.non_empty_rows`. Its `start_save()` returns `added` (new rows), `changed` (pre-existing rows as id plus changed fields), `removed_ids` (every database id no row carries), `commit`, and `discard`. The placeholder row is never in any of them. The client screen (`src/client/route/app/menu/client/`) is the reference.
- **The screen saves through `form_saver`.** `form_saver({ form, send })` calls `form.start_save()`, passes the pending save's `values` to `send`, then calls `commit(result)` on success or `discard()` on failure. The form's `commit` hands each record's save the id the server returned for it, and each array's save the `added` ids in order. Each record snapshots its form values when the save starts, so an edit made while the save was in flight still reads as needing to be saved.

The screen holds the form and the saver and nothing else:

```ts
const lead = make_lead_form()
const saver = form_saver({ form: lead, send: values => server.create_lead(values) })
```

Submit passes the argument straight through:

```svelte
<form onsubmit={saver.on_submit}>
```

The screen does no reshaping, no conversion, and no validation. If submit needs a spread, a ternary, or a `.trim()`, that logic belongs in a child or in the form object.

### 4. Validate with the browser

No hand-written checks in submit. Put `required` on the inputs. The form's submit does not fire until the browser is satisfied. Server errors arrive through `saver.pending_save_promise`. Render them with `{#await saver.pending_save_promise catch err}` and disable the submit button with `saver.saving`.

### 5. Markup and styling

- Every form is a flex column with `var(--gap_unit)` from `src/public/global_variables.css`. Do not restyle `form`.
- Fieldsets use `FieldsetColumn` for vertical stacking, `FormLayout` for the field grid, and `WideTextareaField` for a full-width textarea, all from `#component/`.
- Use the 98.css design system classes that the app loads: `title-bar` with `title-bar-text`, and `title-bar inactive` for a disabled look.
- To keep an element's space without showing it, set `data-hide={condition}` and style `[data-hide="true"] { visibility: hidden }`. Do not use `{#if}` for a control whose absence would change the parent's height.
- Layout is the parent's job. No self-placement on children.
- Use the array functions from `#shared/array.ts`.

### 6. Verify

1. Run `pnpm run test`. Types, svelte-check, and unit tests must pass.
2. Run the svelte-autofixer on every component you wrote or changed. Fix everything except notes about an `$effect` that the Editable user interfaces rule in claude.md calls for.
3. Open the screen in Chrome (`http://localhost:8787/app#/app/<route>`). Check each state the form can be in: new record, pre-existing record.
4. Check the payload without writing to the database. Patch `fetch` in the page to log the body for the server function and throw, then submit:

```js
const orig = window.fetch
window.fetch = async (url, opts) => {
	if (String(url).includes('create_lead')) { console.log('BODY ' + opts.body); throw new Error('intercepted') }
	return orig(url, opts)
}
```

Read the console and compare the body to the validator, field by field. For a screen with tracked records, check these cases: new record (every field), pre-existing record untouched (id only), pre-existing record with one edited field (id plus that field), and a pre-existing parent with a new child row.
