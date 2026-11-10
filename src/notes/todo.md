# TODO

## Caleb 2026-11-06

- "Save proposal" at bottom by total
- Edit all items: plus button in the photo thumbnail view that takes you to the photo mode for that item
- Edit all items: plus button at the bottom that adds a new item (takes you to the single item view, or just adds it there in that view?  Probably adds it in that view)
- Have to at least try the item title input being inside the card, not in the heading
- Move the item type out of the card heading into the card content
- Rename "notes" to Overview
- Rename "line item photo" to "mark up photo"

- Get rid of the minimap at the top
- On edit item page: prev/next item buttons, and the save/done button takes you back to edit all items, probably

Look at how the camera state works with an empty/unsaved line item now first, that behavior will remain important

1. Remove the EstimateMap and EstimateNavBar from every screen
2. The "Notes" state
	- should have a big full-width button at the top "New item" that takes you to the new/first/empty line item on the line item screen
	- resolve function should, if there are line items, redirect to the line_items child state (enforce that you only see the notes state if there are no line items)
	- should have a big link below the current content that says "All projects to estimate" and takes you back to that screen
3. The line item camera state
	- All the current buttons at the top and bottom go away
		- Except for "Take photo", that one should fill the whole bottom width
	- Above the line item title where the current buttons are should be a single full-width button
		- When the current item has changes, button should say "Done with item" and should save + navigate to a new empty line item in the camera view
		- When the current item is new/empty, the button should be replaced with a large "Edit all items" link that occupies the same vertical space as the button, centered vertically, and links to the line_items state
	- The line item title text above the "new item" button should have an edit icon that is a link to the line_item_edit state
		- <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"/></svg>
		- do we have a place to put non-98 icons yet?  Maybe they should be added as Svelte components under component/icon, not sure
	- Let's start off with a navigation bar above this state, we may eventually use in the line_item_edit state, that has a left-aligned link that appears when appropriate linking to the previous line item, text `Back: "[line item title]"`, and a right-aligned link that appears when appropriate linking to the next line item, text `Forward: "[line item title]"`
4. line item photo state
	- Only four buttons visible
		- "Discard" full-width at the very top
		- "Save" full-width at the bottom
		- The existing undo/redo buttons
	- Add a color picker below the discard button, above the photo.  Start with 4 colors.  The current red, a similarly unnatural/bright green, and two other colors that would contrast well enough with the first two.  Should be a fixed height, maybe 40px, and stretch to fill the width.  The selected color needs a selection indicator border around it, but it must not cause the color swatches to resize when the selected item changes.  This must be in its own color picker component that takes the possible colors array and binds to the current selection.
5. line item edit state
	- Remove the current prev/edit/next/discard/go to camera buttons
	- for now, the current theory is you'll only get here from the line item camera state, so when we go "back", that's where we'll go
	- Full-width "Discard" button at the top, ignore changes and navigate back
	- Full width "Save" button at the bottom, disabled if there are no changes to save, saves and navigates back

I'll be around, ask any clarifying questions, resolve any ambiguities that I've left open before implementing.

I'm hoping that the meat of each screen will remain the same, this is mostly a navigation/modal screen change, I'm not expecting a large number of net added lines.

## Notes from showing Andrew 2026-10-30

- 2 decimals on estimate hours
- can't drag and scroll work skill scroll bar if the finger moves off of the scroll path
- line items should have a "primary" image that is the main one the customer sees with the line item
- ask for MOAR cameras and maybe get the zoom one that Andrew wants?

### Very important for actual use

- Need feedback on upload progress
- Need handling for failed/cancelled uploads
- Needs to work taking photos landscape (take up less vertical space in general)
- Delete line items
- Delete photos

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
- cleanup: maybe we don't need asr_joinings_and_leavings

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
