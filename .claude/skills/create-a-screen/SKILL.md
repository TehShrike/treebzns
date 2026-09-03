---
name: create-a-screen
description: Create or restructure a client screen (a *.State.svelte route under src/client/route) and its form components. Use when adding a new page, a new form that calls a server function, or when splitting a screen into child components. Covers state shape, bindings, validation, naming, and verification.
---

# Create a screen

A screen is a `*.State.svelte` file under `src/client/route/`. It registers an abstract-state-router state, resolves its data, and renders the page. A form screen holds one `$state` per server function argument and passes them to the server unchanged. Child components own every input and every conversion.

The reference implementation is `src/client/route/app/create_a_lead/`. Read it before starting a new screen.

## Where things live

- Screen: `src/client/route/app/<screen_name>/<ScreenName>.State.svelte`
- Child components that bind one server argument: `src/client/route/app/<screen_name>/<Thing>Selector.svelte`
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

Type the validator with them (`jv.Validator<{ address: LeadAddress, ... }>`). Regenerate the client caller with `pnpm run build:server_function_types` if the dev server is not running. See the create-server-function skill for the server side.

### 3. Lay out the screen state

One `$state` per server function argument. The variable name is the argument name. The object shape is the argument type. Nothing else.

```ts
let client = $state<LeadClient>({ client_id: null, name: ``, ... })
let billing_address = $state<LeadBilling | null>(null)
let address = $state<LeadAddress>({ client_address_id: null, address_line_1: ``, ... })
let project = $state<LeadProject>({ due_date: null, lead_source_id: null, lead_source_name: null, ... })
let availability = $state<LeadAvailability[]>([])
```

Submit passes them straight through:

```ts
await server.create_lead({ client, billing_address, address, contact, project, availability })
```

The screen does no reshaping, no conversion, and no validation. If submit needs a spread, a ternary, or a `.trim()`, that logic belongs in a child.

Cross-component state that is not sent to the server also lives in the screen, so siblings can read it. Name it for what it is. A row picked from the cache is `selected_pre_existing_<thing>` (`selected_pre_existing_client`, `selected_pre_existing_client_contact`).

### 4. Write one Selector per argument

Each `<Thing>Selector.svelte` binds the argument it owns with `$bindable()`. The prop name is the argument name. Extra bindings are fine for state that siblings need (`bind:selected_pre_existing_client`). Reference data and sibling state come in as plain props.

```svelte
<AddressSelector {selected_pre_existing_client} {client} bind:address bind:billing_address />
```

Inside the selector:

- **Form-only state stays local.** A "has a due date" checkbox, the date input's text, a search string, a lead source option. Convert it to the server shape at the point of change.
- **Use function bindings for single inputs.** `bind:value={() => due_date_text, text => set_due_date(has_due_date, text)}` writes both the local text and `project.due_date` in one setter.
- **Use `$effect` only to mirror state another component owns.** The contact selector copies the client's name and phone into `contact` while "contact is different" is unchecked. The client's inputs live in a sibling, so an effect is the only way to follow them. The svelte-autofixer flags every state write inside an effect. Accept the note for these mirroring effects. Remove any other state write from effects.
- **Reassign union-typed objects whole.** A discriminated union like `{ lead_source_id: bigint, lead_source_name: null } | { lead_source_id: null, lead_source_name: string | null }` cannot be updated one field at a time. Write `project = { ...project, lead_source_id, lead_source_name }`.
- **Defaults belong to the selector.** When `selected_pre_existing_client` changes, the address selector picks the default address and the contact selector picks the matched or primary contact. The screen does not do this.
- **Nullable sub-objects toggle by their own checkbox.** The billing checkbox reads `billing_address !== null`. Checking it builds the object with prefilled values from the client and address. Unchecking it stores the object in a plain `let` draft and sets null, so re-checking restores the draft. The screen renders the child inside `{#if billing_address}`.
- **Initial-value functions take one object.** `get_initial_contact_values({ selected_pre_existing_client, selected_pre_existing_client_contact })`. Name them `get_initial_<thing>_values`.
- **Row groups** (availability windows) keep string rows locally and write the converted, complete rows into the bound array from an effect.

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

Read the console and compare the body to the validator, field by field.
