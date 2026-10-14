# Pending saves

Status: sketch. None of this is built.

## Why

After the server call returns, `tracked_record_array.update_db_values` must find the record behind each saved row. Today each row carries the record's `stable_record_identifier` under a symbol. That symbol exists only for this lookup. Several types exist only to carry it through `form_saver`: `WithStableRecordIdentifier`, `SavedRow`, `ClientValuesToSave`, and `EstimateValuesToSave`.

Instead, the code that builds the payload can keep the records it read. When the server call returns, that same code updates those records directly. No row needs to say which record it came from.

## Shape

Each trackable thing gets a `start_save()` method. It returns a pending save. A pending save holds the payload, a `finish` callback, and a `cancel` callback.

```ts
type PendingSave<ADDED, CHANGED> =
	| { kind: `added`, values: ADDED, finish: (db_id: bigint) => void, cancel: () => void }
	| { kind: `changed`, values: CHANGED, finish: () => void, cancel: () => void }
```

`finish` builds the new `db_values` from the values that went out. The caller passes in only what the server created, which is the new id. `update_db_values` stops being public.

### tracked_record

```ts
let saving = false

start_save: () => {
	assert(!saving, `a record has at most one save running`)
	saving = true
	const cancel = () => { saving = false }

	if (!saved_in_database(db_values)) {
		const values = added_values
		return {
			kind: `added`,
			values,
			finish: (db_id: bigint) => {
				db_values = { ...values, [id_key]: db_id }
				saving = false
			},
			cancel,
		}
	}

	const values = changed_values
	return {
		kind: `changed`,
		values,
		finish: () => {
			db_values = { ...db_values, ...values }
			saving = false
		},
		cancel,
	}
}
```

`added_values` and `changed_values` lose the symbol. They also stop being public, so `start_save` is the only way to build a payload.

### tracked_id_set

```ts
start_save: () => {
	assert(!saving, `an id set has at most one save running`)
	saving = true
	const values = { added_ids: [...ids.difference(db_ids)], removed_ids: [...db_ids.difference(ids)] }
	return {
		values,
		finish: () => {
			db_ids = db_ids.union(new Set(values.added_ids)).difference(new Set(values.removed_ids))
			saving = false
		},
		cancel: () => { saving = false },
	}
}
```

The `added_ids` and `removed_ids` getters go away. Only `start_save` needs those lists. `needs_to_be_saved` and `id_needs_to_be_saved` already compare `ids` with `db_ids` directly.

### Estimate line item

The line item combines the pending saves of its record and its work skills.

```ts
start_save: () => {
	const record_save = record.start_save()
	const work_skills_save = work_skills.start_save()
	const cancel = () => {
		record_save.cancel()
		work_skills_save.cancel()
	}

	if (record_save.kind === `added`) {
		return {
			kind: `added`,
			values: { ...record_save.values, work_skill_ids: work_skills_save.values.added_ids },
			finish: (db_id: bigint) => {
				record_save.finish(db_id)
				work_skills_save.finish()
			},
			cancel,
		}
	}

	return {
		kind: `changed`,
		values: {
			...record_save.values,
			added_work_skill_ids: work_skills_save.values.added_ids,
			removed_work_skill_ids: work_skills_save.values.removed_ids,
		},
		finish: () => {
			record_save.finish()
			work_skills_save.finish()
		},
		cancel,
	}
}
```

A new line item has no work skills in the database. So its `added_ids` holds every id in the set.

### tracked_record_array

```ts
let saving = false

start_save: () => {
	assert(!saving, `a record array has at most one save running`)
	saving = true

	const saves = filter_map(get_records(), record => record.db_id === null || record.needs_to_be_saved ? record.start_save() : null)
	const added = filter(saves, save => save.kind === `added`)
	const changed = filter(saves, save => save.kind === `changed`)
	const removed_ids = [...db_ids.difference(record_db_ids())]

	return {
		added: map(added, save => save.values),
		changed: map(changed, save => save.values),
		removed_ids,
		finish: (added_db_ids: readonly bigint[]) => {
			assert(added_db_ids.length === added.length, `the server returns one id per added record`)
			for_each(zip_with(added, added_db_ids, (save, db_id) => ({ save, db_id })), ({ save, db_id }) => {
				save.finish(db_id)
				db_ids.add(db_id)
			})
			for_each(changed, save => save.finish())
			for_each(removed_ids, id => db_ids.delete(id))
			saving = false
		},
		cancel: () => {
			for_each(saves, save => save.cancel())
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
	assert(project_save.kind === `changed`, `the project is in the database`)
	const line_items_save = line_item_records.start_save()

	return {
		values: {
			project: project_save.values,
			added_line_items: line_items_save.added,
			changed_line_items: line_items_save.changed,
			removed_line_item_ids: line_items_save.removed_ids,
		},
		finish: (result: UpdateEstimateResult) => {
			project_save.finish()
			line_items_save.finish(result.added_line_item_ids)
		},
		cancel: () => {
			project_save.cancel()
			line_items_save.cancel()
		},
	}
}
```

The form keeps `needs_to_be_saved`. It loses `values_to_save` and `update_db_values`.

### form_saver

```ts
const save = async () => {
	save_error = null
	saving = true
	const pending = form.start_save()
	let result
	try {
		result = await send(pending.values)
	} catch (err) {
		pending.cancel()
		save_error = error_message(err)
		saving = false
		return
	}
	pending.finish(result)
	saving = false
}
```

`on_save` becomes `send`. It returns the server result and no longer updates the form. `Client.State.svelte` can still refresh the client cache inside `send`.

`finish` sits outside the `try`. A failed assert in `finish` is a bug, so it should not show up as a save error.

## The saving flag

`saving` can be a plain `let`. Nothing renders it. `form_saver` keeps its own `$state` flag for the buttons.

| Method | Asserts `!saving` | Why |
|---|---|---|
| `start_save` on records, id sets, and arrays | yes | Two saves at once insert an added record twice. |
| `tracked_record.set_values`, `tracked_record.clear` | yes | They replace `db_values`. `finish` builds on `db_values`, so a swap during a save mixes two rows. |
| `tracked_id_set.add`, `tracked_id_set.delete` | no | The work skill pills stay clickable during a save. The set compares `ids` with `db_ids`, so a click during a save stays pending. |
| writes to `form_values` | no | Edits made during a save stay pending. Also, `bind:value` writes straight into the `$state` proxy, so no setter sees them. |

Getters should not assert. Templates read `needs_to_be_saved`, `value_needs_to_be_saved`, `is_empty`, and `form_values` on every render. The page keeps rendering during a save, so an assert in a getter would crash it. Making `added_values` and `changed_values` private covers the getters that matter, the ones that build a payload.

## What happens during a save

| What the user does during a save | Result |
|---|---|
| Edits a field | `finish` moves `db_values` to what was sent. The edit still differs, so it saves next time. |
| Adds a row | The row is not in the pending save. It shows as added next time. |
| Deletes a row that is being added | `finish` still gives the record its id, and `db_ids` gets that id. The next save deletes it. |
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

## Open questions

- `lead_form.svelte.ts` reads `added_values` and `changed_values` directly. `create_lead` returns `project_id` and `client_id`, but not the address or contact ids, so `lead_form` cannot finish those saves. The screen leaves after a save, so it may only need `cancel`. Or `create_lead` could return every id.
- `update_client` returns one id for every contact and address it gets, both added and changed. `client_form` lists added rows first. So `finish` could take the first ids, one per added row. Or `update_client` could return only the added ids, like `update_estimate`.
- If the server commits but the response never arrives, the client cancels. The next save then inserts the added rows a second time. Today's code has the same problem.
