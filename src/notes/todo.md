# TODO

## This week

- Finish immediate review
- Make sure deployed code works in production
- Check estimate process practically
- Sync prod data

### Check estimate process practically

- Single line item page should have two modes.  "Take photo" and "View"
	- Take photo is the current one
	- View should let you flip between photos and hit a button to go into edit mode
	- A button at the bottom that lets you go between the two modes
- Taking a photo
	- "Text" button needs to be live, show an input somewhere (area between camera and bottom buttons?)
		- Should sync directly to the line item's description, saved with photo
- Editing a photo
	- Editing photo should be centered like when taking a photo.  Or maybe taking a photo should be top aligned like viewing a photo?
	- Undo/redo buttons
- "Photos" button should say "take photos"? take you to the camera view for an existing line item?
- Rename "Upload" to "Save photo", rename "Cancel" to "Discard photo", "Next" should say "Next line"

Could really use some kind of line editing (work skills, line type)

## Review

estimate_form.svelte.ts: is the modelling of work skills tolerable?  Do we need a tracked map of some kind?
Is it reasonable to have the `if (record_save.adding) {` instead of separate start_add/start_change functions?

## Make the estimation/proposal editing screen tolerable

On the Proposal page -> estimates, the link should take you to the line item view if the project has line items.

The line item price needs to be saved.

Let's make a component/IntegerInput that works the same way as NumberInput with type=number, except with an implicit decimal_places=0 and binding to a bigint not a FinancialNumber.  Default style should be the same as every other input, though it would be nice to have a list_input specific one that uses it, but overrides the styles similarly to what NumberInput does.  In fact, could we do the same thing for NumberInput – put one in component that has all the behavior, but the regular styles from 98, and then a version in list_input that just makes it look appropriately flat like other list_input cells when not focused?

hours_text, crew_size_text, calculated_hours_text, hourly_rate_text should all be bigints, not strings.

project subtotal, taxable_subtotal, line_item_discount_subtotal, tax_total, total should be calculated.  Actually, look into this – should we even be calculating taxes at estimation/proposal time, or is that a work-order-time concern?

### Estimate editing screen

- Allow editing line item discount_rate, discount, discount_description
- Allow editing project-level discount (which disables line-item level discount)
- Display totals at bottom of estimate
- Upload images?
- Allow changing sort
- On large screens, images should be the left half, every other input should be on the right half, capped at something like 600px width
- issues on Safari: see screenshot in Dropbox 2026-10-19T11:34:24
- expose photo property: visible_to_client
- deleting line items
- editing line item title
- allow editing project.notes_for_crew and project.notes_for_office
- "save line item as template"?

Then think about "sending for proposal" at this stage of the design – a "send" button should mark the proposal as sent, show you the proposal page, and if you are logged in, give you an easy-to-copy url to send to the client.

## What project list screens do we need?

- Leads to estimate
- Proposals to submit
- Accepted projects (work orders to schedule)
- Work orders to work

## Things to turn into tickets maybe

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
