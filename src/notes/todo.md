# Catch up

## Follow-on work from the tracked_record/tracked_set/form_saver rework

✓ update LineItemCard to use $props.id() where appropriate, and any other places where I was doing something similar.

✓ In LineItem.State, in the resolve I think image_ids should be renamed to line_item_id_to_image_ids and same work work_skill_ids.

✓ Convert the typed_write_helper methods with 4 or more arguments to an object with named properties instead of positional arguments.

✓ notes/pending_saves.md – the save lifecycle needs to be represented in form_saver/tracked_record/etc, with saves being committed after the promise resolves.

✓ tracked_id_set can't expose a cancel function.  Expose a `_values` property for tests if you must.  Or even better, have the tests call the save function and just make assertions about the values on the object it returns.

tracked_record.svelte.ts has a lot of "as" type assertions, is there any way that we could make the original/core types more accurate, or used named variables with types, so that we wouldn't need to use type assertions?  I want to make the types more correct, but ideally not more complex.

client_form needs to change to expose added/changed/removed contacts and addresses.  The update server function should change to take that type.  Look for other server functions that ought to be converted to taking added/changed/removed rather than assuming that an array represents everything that should be in the database.

What is the difference between added_values and changed_values?  Should we just have one changed_values, and the way you know if it is added or not is if saved_in_database?

On the create-a-lead screen, disable the client search, Clear button, and address/contact pickers while saving.

We can't just swallow errors line in LineItems.State's `done`.  We need some pattern for displaying errors, probably right next to the "save" button.  Perhaps we should have a promise in component scope that the saver.save() return gets assigned to, rather than awaiting saver.pending_save_promise, just so that it's clear that we're not swallowing the error.

In the forms that contain multiple tracked records, could there be a helper "tracked forms" that wrapped them all up, taking an object with named properties, and exposed a single save that returned a single values+commit+discard?

...and THEN let's actually poke at the new estimate UI!

## Other notes

Why does EstimateLineItemUpdate have work_skill_ids optional?  Surely it should be an empty array or have values, depending on the user's selection, the user shouldn't be allowed to not make a choice about work skills.

I don't know why work_skill_ids could ever be undefined in estimate_form.svelte.ts.

update_estimate must be able to insert new line items as well.  The UI will soon be altered to allow creating new line items.  It should use the upsert pattern.

PillCheckbox has too much css

LineItemCard, LineItems.

In LineItems.State's resolve, do we really need all those line item queries?  I would like to be able to group by line item id and use aggregate functions to get an array of the unique image ids and work skill ids for each line item.

In estimate_form.svelte.ts, why aren't we using tracked_record_array for line_items?  Why does each line item need its own form?

## Next steps

- Can we delete the project_image records wherever line items are deleted during the import process, rather than where that stale_line_item_filter is being used in import_line_items?
- Upload each image in its own request, rather than 3-in-1
- some day, we will want to upload straight to Spaces from the browser.  Maybe even today?
> Presigned PUT URLs, so the browser uploads straight to Spaces. The Worker handles no photo bytes at all. presign_url already supports PUT.
> - Cost: the bucket needs a CORS rule, and a "finish" call is needed afterward. The JPEG check moves after the upload (a Range GET of the first 3 bytes, then delete the file if it fails). The presigned URL must be requested when the upload queue sends the photo, not when the photo is taken, or it can expire while the device is offline.
- Image caching needs to be a little more central, a little better-defined than just `browser_response` and `cache_seconds` in project_image_file

## Estimation

https://discord.com/channels/@me/256500497706385409/1547412310069346334

> Take pictures, create line item, add photos, mark photos as needed, add work order description.

- Take pictures
- Separate pictures into line items
- Pick line item types, hours, description
- List of photos gets shorter as you allocate photos to line items

Project needs "estimated crew size"

## Create a lead

- Due date date picker needs to always be visible, but disabled when not "Has a due date"

## Logs

- Bot log
	- ~/.codex/sessions/YYYY/MM/DD/
	- ~/.claude/projects/-Users-joshduff-git-treebzns/

## List of screens to make

Keep iterating on the "create a screen" skill.

Client-facing
- View Invoice page
- View Proposal page
- View Work Order page
- Automatic emails
- Automatic SMS
- Accept payments

Project management
- Client
- Project list
- Project
- Scheduling: week/all jobs
- Scheduling: day

Worker
- Estimating (phone UI)
- Foreman/project check-in

Backend
- Settings page
- Permissions
- Edit crews



## Other

- Permissions
- Which email/sms triggers are necessary
- Use a trie thing for client search autocomplete
- DateTimeInput – maybe we can pull a single date picker out of it and use that on Create A Lead

## After the create-a-lead/project screens

Use the tree inventory.  Search it/filter.  Then show on a map.

# Sending sms/emails: queue

Work queue table with the work, `attempts` count, some way to mark it as claimed.

```sql
UPDATE ... SET claimed_at = NOW(), attempts = attempts + 1, next_attempt_at = NOW() + backoff WHERE id = ?
```

Use `waitUntil` in CFW to launch the worker to try to work that record after returning the response?

Cloudflare Cron Triggers run every minute, launch worker that attempts to work everything in the queue.

https://claude.ai/chat/f5f9361d-f698-43b1-9184-a0ab885d01ed

# Must-haves

Add screens descriptions for these, to motivate modeling and implementation.

- client billing
	- client card processing!
- ways for people to sign online – close rates CAN NOT get worse
- photos – probably markup
- sms, email notification
	- sms needs built-in chat UI somewhere.  Could it be the same UI as email?
	- probably need scheduling from day one
	- top priority: followups on estimates

# Little/vague stuff

- Input focus border needs to look the same everywhere (embrace the rounding I guess)
- Client page needs some kind of default filter so that it doesn't list everything – maybe "has open project" or something

# Customer-facing page for proposals/projects

# "Create A Lead" interface

- identify everything that needs to be an input when creating a lead - look at the schema
- basic text input

# Deploying

- Finish deploy
	- Add mysql user to prod database for CFW
	- add mysql environment variables to CFW
	- Wrangler deploy CFW from master

# Export/import

- Chrome extension
- Make `fetch` calls with cookies
- https://claude.ai/chat/a7d94343-6ef6-4cb4-9062-2b4796cf1e36
- some endpoint that clients and leads can be uploaded to

# some time

- auto-prettify
- Redirect to app after creating company
- livereload in browser
- safer migration deploys
	- set a variable when deploying
	- have a worker check that variable and pause prod api requests
	- run migration while paused
