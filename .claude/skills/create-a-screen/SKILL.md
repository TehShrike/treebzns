---
name: create-a-screen
description: Create or restructure a client screen (a *.State.svelte route under src/client/route) and its form components. Use when adding a new page, a new form that calls a server function, or when splitting a screen into child components. Covers state shape, bindings, validation, naming, and verification.
---

# Create a screen

A screen is a `*.State.svelte` file under `src/client/route/`. It registers an abstract-state-router state, resolves its data, and renders the page. A form screen holds one form object whose `values_to_save` is the server function argument. The form object lives in a `<form_name>_form.svelte.ts` module next to the screen. Child components own every input and every conversion.

The reference implementation is `src/client/route/app/create_a_lead/`. Read it before starting a new screen.

## Where things live

- Screen: `src/client/route/app/<screen_name>/<ScreenName>.State.svelte`
- The form object: `src/client/route/app/<screen_name>/<form_name>_form.svelte.ts`
- Child components that own one record or argument: `src/client/route/app/<screen_name>/<Thing>Selector.svelte`
- Records that may already exist in the database: `#client/lib/tracked_record.svelte.ts`
- Small layout or input helpers used only by this screen: `src/client/route/app/<screen_name>/_helpers/`
- Components used by more than one screen: `src/client/component/`
- Argument types shared with the server: `#shared/type/<domain>.ts`
- Generated state registry (do not edit): `src/client/globbed_states.generated.ts`

## Steps

### 1. Register the state

Put the state definition in the module script. Fetch reference data in `resolve` with the typed query builder, in one `Promise.all`.

```svelte
<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'

	export const asr_state = state_type({
		name: `app.create_a_lead`,
		route: `/create_a_lead`,
		resolve: async ({ client_cache, query, server }) => {
			const [tax_rates, employees] = await Promise.all([
				fetch_tax_rates(query),
				fetch_employees(query),
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

Each fetch is a small module-level function that takes `query: ClientQueryFn` and returns plain rows. The dev watcher (`dev:glob:states`) regenerates the state registry on save. Run `pnpm run build:glob:states` when the dev server is not running.

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

The form object is a closure in `<form_name>_form.svelte.ts`. It owns every value the server receives and derives the whole argument as `values_to_save`. The screen creates it once and passes its parts to the selectors.

```ts
const make_lead_form = (initial_estimator_employee_id: bigint | null) => {
	const client = tracked_record<LeadClientValues, 'client_id'>({ initial: { name: ``, ... }, id_key: `client_id` })
	const address = tracked_record<LeadAddressValues, 'client_address_id'>({ initial: { address_line_1: ``, ... }, id_key: `client_address_id` })

	let selected_client = $state.raw<CachedClient | null>(null)
	let billing_address = $state<LeadBilling | null>(null)
	let project = $state<LeadProject>({ due_date: null, lead_source_id: null, lead_source_name: null, ... })

	const values_to_save = $derived({ client: client.values_to_save, billing_address, address: address.values_to_save, project })

	const select_client = (cached_client: CachedClient) => { ... }
	const clear_client = () => { ... }

	return {
		client,
		address,
		get selected_client() { return selected_client },
		get billing_address() { return billing_address },
		set billing_address(value) { billing_address = value },
		get project() { return project },
		set project(value) { project = value },
		get values_to_save() { return values_to_save },
		select_client,
		clear_client,
	}
}
```

- **A record that may already exist is a `tracked_record`.** It holds `form_values` (what inputs bind to), `db_values` (the cached row the user picked, or null), `value_needs_to_be_saved(key)`, and `values_to_save`. For a new record `values_to_save` is every field with a null id. For a pre-existing record it is the id plus the fields whose form value differs from the database value. `set_values(row)` picks a row and copies its values into the form. `clear()` returns to a new record.
- **Always-new arguments are plain `$state` in the closure.** Put them behind a getter and a setter so `bind:project={lead.project}` works from the screen.
- **The picked cached row lives in the closure** (`selected_client`), so the selectors can read its child rows for their dropdowns. Use `$state.raw` for it. Nothing mutates it.
- **Picking and clearing are methods on the form.** `select_client` sets the client record, picks the default address and contact, and resets billing. `clear_client` clears all three records. No `$effect` watches the picked row.

The screen holds the form and nothing else:

```ts
const lead = make_lead_form(untrack(() => in_estimator_order(employees)[0]?.employee_id ?? null))
```

Submit passes the derived argument straight through:

```ts
await server.create_lead(lead.values_to_save)
```

The screen does no reshaping, no conversion, and no validation. If submit needs a spread, a ternary, or a `.trim()`, that logic belongs in a child or in the form object.

### 4. Write one Selector per record or argument

Each `<Thing>Selector.svelte` receives the record or argument it owns. A `tracked_record` comes in as a plain prop, because its `form_values` is already reactive. An always-new argument that the selector reassigns whole (`project`) or toggles to null (`billing_address`) is bound with `$bindable()`. Reference data and cached child rows come in as plain props.

```svelte
<ClientSelector {client_cache} {tax_rates} {lead} />
<AddressSelector
	client={lead.client}
	client_addresses={lead.selected_client?.client_addresses ?? []}
	address={lead.address}
	bind:billing_address={lead.billing_address}
/>
<ProjectSelector bind:project={lead.project} bind:availability={lead.availability} />
```

Inside the selector:

- **Form-only state stays local.** A "has a due date" checkbox, the date input's text, a search string, a lead source option. Convert it to the server shape at the point of change.
- **Use function bindings for single inputs.** `bind:value={() => due_date_text, text => set_due_date(has_due_date, text)}` writes both the local text and `project.due_date` in one setter.
- **Use `$effect` only to mirror state another component owns.** The contact selector copies the client's name and phone into `contact` while "contact is different" is unchecked. The client's inputs live in a sibling, so an effect is the only way to follow them. The svelte-autofixer flags every state write inside an effect. Accept the note for these mirroring effects. Remove any other state write from effects.
- **Reassign union-typed objects whole.** A discriminated union like `{ lead_source_id: bigint, lead_source_name: null } | { lead_source_id: null, lead_source_name: string | null }` cannot be updated one field at a time. Write `project = { ...project, lead_source_id, lead_source_name }`.
- **A saved-row dropdown drives the record.** `<select bind:value={() => address.db_values, row => row ? address.set_values(row) : address.clear()}>` with one `<option value={row}>` per cached row and an `<option value={null}>` for a new row. The option values are the cached rows themselves, so `db_values` must keep the same reference it was given.
- **Defaults belong to the form object.** `select_client` picks the default address and the matched or primary contact. Selectors do not watch the picked row.
- **Nullable sub-objects toggle by their own checkbox.** The billing checkbox reads `billing_address !== null`. Checking it builds the object with prefilled values from the client and address. Unchecking it stores the object in a plain `let` draft and sets null, so re-checking restores the draft. The screen renders the child inside `{#if billing_address}`.
- **Row groups** (availability windows) keep string rows locally and write the converted, complete rows into the bound array from an effect.
- **Mark inputs whose value is already in the database.** Set `data-value-needs-to-be-saved={client.value_needs_to_be_saved(`name`)}` on each input of a tracked record. The 98.css rule paints an input with `"false"` in the app background. The same test decides which fields go in `values_to_save`, so the style and the payload cannot disagree. A new record has no database row and every input reads as new.

### 5. Validate with the browser

No hand-written checks in submit. Put `required` on the inputs. For a row where all fields must be filled once any is filled, compute `required` per row:

```svelte
{@const required = window.date !== `` || window.from !== `` || window.to !== ``}
<input type="date" {required} bind:value={window.date}>
```

The form's submit does not fire until the browser is satisfied. The screen keeps a `save_error` string for server errors only.

### 6. Markup and styling

- Every form is a flex column with `var(--gap_unit)` from `global_styles.css`. Do not restyle `form`.
- Fieldsets use `FieldsetColumn` for vertical stacking and `FormLayout` from `#client/component/` for the field grid.
- Use the 98.css design system classes that the app loads: `title-bar` with `title-bar-text`, and `title-bar inactive` for a disabled look. The current client header on the lead screen is a title bar.
- To keep an element's space without showing it, set `data-hide={condition}` and style `[data-hide="true"] { visibility: hidden }`. Do not use `{#if}` for a control whose absence would change the parent's height.
- Layout is the parent's job. No self-placement on children.
- Use the array functions from `#shared/array.ts`.

### 7. Verify

1. Run `pnpm run test`. Types, svelte-check, and unit tests must pass.
2. Run the svelte-autofixer on every component you wrote or changed. Fix everything except the effect notes described in step 4.
3. Open the screen in Chrome (`http://localhost:8787/app#/app/<route>`). Check each state the selectors can be in: new record, pre-existing record picked, toggles on and off.
4. Check the payload without writing to the database. Patch `fetch` in the page to log the body for the server function and throw, then submit:

```js
const orig = window.fetch
window.fetch = async (url, opts) => {
	if (String(url).includes('create_lead')) { console.log('BODY ' + opts.body); throw new Error('intercepted') }
	return orig(url, opts)
}
```

Read the console and compare the body to the validator, field by field. For a screen with tracked records, check these cases: new record (every field), pre-existing record untouched (id only), pre-existing record with one edited field (id plus that field), and a pre-existing parent with a new child row.
