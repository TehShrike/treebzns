# TODO

## This week

- Make sure deployed code works in production
- Check estimate process practically
- Sync prod data

### Very important for actual use

- Need feedback on upload progress
- Need handling for failed/cancelled uploads
- Needs to work taking photos landscape (take up less vertical space in general)

### Check estimate process practically

- The `save_if_needed` pattern is unacceptable, we can't swallow errors.  Maybe add a report_errors(fn) function that takes an async function and wraps it in a try/catch that displays any error messages on the screen somewher.
- Is `store_markup_files` really necessary, is there no other image-saving function that can be used already
- wtf is `if_none_match`
- When editing line item crew size: the project-level estimated crew should increase if the line item's crew is larger than the current maybe?
- Guards to block navigating with unsaved changes
- Split line interface: click a "split" button, choose a new item type, have current/new fields for title/description/skills.

### More notes on estimate editing

- Allow editing line item discount_rate, discount, discount_description
- Allow editing project-level discount (which disables line-item level discount)
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
- some day, we will want to upload straight to Spaces from the browser
	- Presigned PUT URLs, so the browser uploads straight to Spaces. The Worker handles no photo bytes at all. presign_url already supports PUT.
	- Cost: the bucket needs a CORS rule, and a "finish" call is needed afterward. The JPEG check moves after the upload (a Range GET of the first 3 bytes, then delete the file if it fails). The presigned URL must be requested when the upload queue sends the photo, not when the photo is taken, or it can expire while the device is offline.
- Image caching needs to be a little more central, a little better-defined.  We have some hacky etags-in-querystrings in the image gallery right now

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
