# Pending saves

Status: built. The sketches below match the code, apart from the decisions at the end.

## Why

After the server call returns, `tracked_record_array.update_db_values` must find the record behind each saved row. Today each row carries the record's `stable_record_identifier` under a symbol. That symbol exists only for this lookup. Several types exist only to carry it through `form_saver`: `WithStableRecordIdentifier`, `SavedRow`, `ClientValuesToSave`, and `EstimateValuesToSave`.

Instead, the code that builds the payload can keep the records it read. When the server call returns, that same code updates those records directly. No row needs to say which record it came from.

## Shape

Each trackable thing gets a `start_save()` method. It returns a pending save. A pending save holds the payload, a `commit` callback, and a `discard` callback.

```ts
type PendingSave<ADDED, CHANGED> =
	| { adding: true, values: ADDED, commit: (db_id: bigint) => void, discard: () => void }
	| { adding: false, values: CHANGED, commit: (db_id?: bigint) => void, discard: () => void }
```

`commit` builds the new `values_in_db` from the values that went out. The caller passes in only what the server created, which is the new id. A changed save takes the id too, when the caller has it, and asserts it matches the id it already holds. So a form that gets an id back from the server calls `commit(id)` without checking `adding`. `update_db_values` stops being public.

### tracked_record

```ts
const start_add = ({ id_key, form_values, commit, discard }): PendingAdd<AddedValues> => {
	const values = { [id_key]: null, ...form_values }
	return {
		adding: true,
		values,
		commit: (db_id: bigint) => { commit({ ...values, [id_key]: db_id }) },
		discard,
	}
}

const start_change = ({ id_key, current, form_values, values_equal, commit, discard }): PendingChange<SavedValues> => {
	const values = { [id_key]: current[id_key], ...form values that differ from current }
	return {
		adding: false,
		values,
		commit: (db_id?: bigint) => {
			assert(db_id === undefined || db_id === current[id_key], `the server saved the record the client sent`)
			commit({ ...current, ...values })
		},
		discard,
	}
}

let saving = false
const commit = (next: DbValues) => {
	values_in_db = next
	saving = false
}
const discard = () => { saving = false }

start_save: () => {
	assert(!saving, `a record has at most one save running`)
	saving = true
	return saved_in_database(values_in_db)
		? start_change({ id_key, current: values_in_db, form_values, values_equal, commit, discard })
		: start_add({ id_key, form_values, commit, discard })
}
```

`start_add` and `start_change` live outside the record closure. Each takes the form values and the record's `commit`, reads the form values once, and keeps only the payload it built. It and builds one half of the `PendingSave` union, `PendingAdd` or `PendingChange`. Neither is public, so `start_save` is the only way to build a payload.

Every pending save carries the record's id key. An added save carries `null` and a changed save carries the id from `values_in_db`. So a new row and an existing row have one shape apart from the id, and the server validators for `added_*` rows expect the null id.

### tracked_id_set

```ts
start_save: () => {
	assert(!saving, `an id set has at most one save running`)
	saving = true
	const values = { added_ids: [...ids.difference(ids_in_db)], removed_ids: [...ids_in_db.difference(ids)] }
	return {
		values,
		commit: () => {
			ids_in_db = ids_in_db.union(new Set(values.added_ids)).difference(new Set(values.removed_ids))
			saving = false
		},
		discard: () => { saving = false },
	}
}
```

The `added_ids` and `removed_ids` getters go away. Only `start_save` needs those lists. `needs_to_be_saved` and `id_needs_to_be_saved` already compare `ids` with `ids_in_db` directly.

### Estimate line item

The line item combines the pending saves of its record and its work skills. `start_add` and `start_change` live outside the closure. Each takes the record's half of its pending save, the work skills save, and the shared `commit` and `discard`.

```ts
const start_add = ({ record_save, work_skills_save, commit, discard }) => {
	assert(work_skills_save.values.removed_ids.length === 0, `a line item that is not in the database has no work skills in the database`)
	return {
		adding: true,
		values: { ...record_save.values, work_skill_ids: work_skills_save.values.added_ids },
		commit,
		discard,
	}
}

const start_change = ({ record_save, work_skills_save, commit, discard }) => ({
	adding: false,
	values: {
		...record_save.values,
		added_work_skill_ids: work_skills_save.values.added_ids,
		removed_work_skill_ids: work_skills_save.values.removed_ids,
	},
	commit: (db_id = record_save.values.project_line_item_id) => { commit(db_id) },
	discard,
})

start_save: () => {
	const record_save = record.start_save()
	const work_skills_save = work_skills.start_save()
	const commit = (db_id: bigint) => {
		record_save.commit(db_id)
		work_skills_save.commit()
	}
	const discard = () => {
		record_save.discard()
		work_skills_save.discard()
	}
	return record_save.adding
		? start_add({ record_save, work_skills_save, commit, discard })
		: start_change({ record_save, work_skills_save, commit, discard })
}
```

The shared `commit` takes a required id, because it calls `record_save.commit` before `adding` narrows the record save, and the added half takes a required id. The changed half fills in the id it already carries when the caller passes none, so the array can still call it bare.

A new line item has no work skills in the database. So its `added_ids` holds every id in the set.

### tracked_record_array

```ts
let saving = false

start_save: () => {
	assert(!saving, `a record array has at most one save running`)
	saving = true

	const saves = filter_map(get_records(), record => record.db_id === null || record.needs_to_be_saved ? record.start_save() : null)
	const added = filter(saves, save => save.adding)
	const changed = filter(saves, save => !save.adding)
	const removed_ids = [...ids_in_db.difference(record_db_ids())]

	return {
		added: map(added, save => save.values),
		changed: map(changed, save => save.values),
		removed_ids,
		commit: (added_db_ids: readonly bigint[]) => {
			assert(added_db_ids.length === added.length, `the server returns one id per added record`)
			for_each(zip_with(added, added_db_ids, (save, db_id) => ({ save, db_id })), ({ save, db_id }) => {
				save.commit(db_id)
				ids_in_db.add(db_id)
			})
			for_each(changed, save => save.commit())
			for_each(removed_ids, id => ids_in_db.delete(id))
			saving = false
		},
		discard: () => {
			for_each(saves, save => save.discard())
			saving = false
		},
	}
}
```

The server returns the new ids in the order the payload listed the added rows. Today's code already depends on that order, through the `zip_with` calls in `Client.State.svelte` and `estimate_form.svelte.ts`.

The array needs its own flag, apart from the records' flags. A save that only removes rows starts no record saves, so no record flag would catch a second save.

### Form

```ts
start_save: () => {
	const project_save = project.start_save()
	assert(!project_save.adding, `the project is in the database`)
	const line_items_save = line_item_records.start_save()

	return {
		values: {
			project: project_save.values,
			added_line_items: line_items_save.added,
			changed_line_items: line_items_save.changed,
			removed_line_item_ids: line_items_save.removed_ids,
		},
		commit: (result: UpdateEstimateResult) => {
			project_save.commit(result.project_id)
			line_items_save.commit(result.added_line_item_ids)
		},
		discard: () => {
			project_save.discard()
			line_items_save.discard()
		},
	}
}
```

The form keeps `needs_to_be_saved`. It loses `values_to_save` and `update_db_values`.

### form_saver

```ts
const save = () => {
	const pending = form.start_save()
	const sent = send(pending.values)
		.catch(err => {
			pending.discard()
			throw new Error(error_message(err), { cause: err })
		})
		.then(result => { pending.commit(result) })
	pending_save_promise = sent
	saving = true
	const settle = () => { saving = false }
	sent.then(settle, settle)
	return sent
}
```

`on_save` becomes `send`. It returns the server result and no longer updates the form. `Client.State.svelte` can still refresh the client cache inside `send`.

`save` returns the promise and `pending_save_promise` holds it. The screens show the error with `{#await saver.pending_save_promise catch err}`, so there is no `save_error` field. The promise stays set after it rejects so the error stays on the page, which is why the buttons read the `saving` boolean rather than the promise.

`commit` runs on the same promise. A failed assert in `commit` rejects the save like any other failure, so the page shows it and `done` does not leave the screen. The only assert on that path checks that the server returned one id per added row, which belongs on the page.

## The saving flag

`saving` can be a plain `let`. Nothing renders it. `form_saver` keeps its own `$state` flag for the buttons.

| Method | Asserts `!saving` | Why |
|---|---|---|
| `start_save` on records, id sets, and arrays | yes | Two saves at once insert an added record twice. |
| `tracked_record.set_values`, `tracked_record.clear` | yes | They replace `values_in_db`. `commit` builds on `values_in_db`, so a swap during a save mixes two rows. |
| `tracked_id_set.add`, `tracked_id_set.delete` | no | The work skill pills stay clickable during a save. The set compares `ids` with `ids_in_db`, so a click during a save stays pending. |
| writes to `form_values` | no | Edits made during a save stay pending. Also, `bind:value` writes straight into the `$state` proxy, so no setter sees them. |

Getters should not assert. Templates read `needs_to_be_saved`, `value_needs_to_be_saved`, `is_empty`, and `form_values` on every render. The page keeps rendering during a save, so an assert in a getter would crash it. Making `added_values` and `changed_values` private covers the getters that matter, the ones that build a payload.

## What happens during a save

| What the user does during a save | Result |
|---|---|
| Edits a field | `commit` moves `values_in_db` to what was sent. The edit still differs, so it saves next time. |
| Adds a row | The row is not in the pending save. It shows as added next time. |
| Deletes a row that is being added | `commit` still gives the record its id, and `ids_in_db` gets that id. The next save deletes it. |
| Deletes a row that is being changed | The change saves. The id stays in `removed_ids`, so the next save deletes it. |
| Clears an added row until it is empty | `editable_rows` drops the row once focus leaves it. The result is the same as deleting it. |
| Toggles a work skill | The toggle stays pending. |
| Clicks Save or Done again | The buttons are disabled. If code calls `save` anyway, `start_save` throws instead of inserting twice. |

## What goes away

- the `stable_record_identifier` symbol and `WithStableRecordIdentifier`
- `SavedRow`, `ClientValuesToSave`, and `EstimateValuesToSave`
- the public `update_db_values` on records, id sets, arrays, and forms
- `values_to_save` on the forms
- the `zip_with` calls in `Client.State.svelte` and `estimate_form.svelte.ts`

The `stable_record_identifier` property on records stays. The UI uses it for `#each` keys, `editable_rows`, and the work details element id.

## Decisions

- `create_lead` returns `project_id`, `client_id`, `client_address_id`, and `client_contact_id`. So `lead_form` commits all three record saves.
- `update_client` takes `added_contacts`, `changed_contacts`, `added_addresses`, and `changed_addresses`, like `update_estimate`. It returns `added_contact_ids` and `added_address_ids`, one per added row, in payload order.
- `tracked_record_array` takes no `id_key`. The server returns the new ids in payload order, so the array never reads an id off a row.
- `tracked_id_set.commit` adds and deletes on the `SvelteSet` in place. `union` and `difference` would return a plain `Set` and lose reactivity.

## Still open

- If the server writes the rows but the response never arrives, the client discards the save. The next save then inserts the added rows a second time. The old code had the same problem.
