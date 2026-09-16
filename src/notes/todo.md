# Catch up

What's the difference between qualified/unqualified lead.  Should both be estimated?

Should both exist?  Does anyone care about the difference?  When does the estimator get sent out?  If nothing else, a lead created by an office worker using the create-a-lead screen should probably count as qualified, eh?

## Review PhotoCamera.svelte and directory, and PhotoMarkup.svelte

I want to get the camera instance/creating out of PhotoCamera, and also eliminate some localstorage.

## Throw error responses

In response_helpers, create an Error subclass that has a status property.  error_object_response should check for that instanceof, and should use that status if it exists.  This can be thrown instead of UploadError.  Then we can eliminate ParsedProjectImageUpload.

Replace await request.formData() with a function that returns the form data and throws one of those error responses if there is an issue.

## Estimation

https://discord.com/channels/@me/256500497706385409/1547412310069346334

> Take pictures, create line item, add photos, mark photos as needed, add work order description.

- Take pictures
- Separate pictures into line items
- Pick line item types, hours, description
- List of photos gets shorter as you allocate photos to line items

Project needs "estimated crew size"

### To-estimate list



## Create a lead

- Due date date picker needs to always be visible, but disabled when not "Has a due date"

## Deploy to dedicated Cloudflare account

- [x] Create a new email address
	- treesoftware@joshduff.com?
- [x] Business card: Chase Ink Business Unlimited
- [ ] Wait for new credit card to arrive, add it to 1Password
- [x] Create a new Cloudflare account
- [ ] Subscribe to Workers Paid
- [ ] Buy domain name treeoperator.com
- [ ] Configure the worker
	- [ ] Configure environment variables
	- [ ] Hyperdrive
- [ ] Create new Digital Ocean account with new credit card
- [ ] Create new managed DO database
- [ ] Deploy from CI

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
