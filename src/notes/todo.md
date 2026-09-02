# Catch up

## Create a lead

I suspect that each component should bind to an object that represents the thing that will actually be sent to the server, including all validation, as much as possible.  Let's push towards making that happen, and then we can implement change detection at the top level.  Or maybe even inside each nested component?  Eh, that might be too much complexity near the actual UI.

- For a record that has been saved already, inputs that have not been changed should appear less input-like (background same as the screen background color?)
	- Need to track state-changed-since-database-version per entity
- Review components and state management for sanity
- Due date date picker needs to always be visible, but disabled when not "Has a due date"
- Build an initial "create a screen" skill

## Deploy to dedicated Cloudflare account

- [ ] Create a new email address
	- treesoftware@joshduff.com?
- [ ] Create a new Cloudflare account with a new email address
- [ ] Transfer dufftreesoftware.com to the new Cloudflare account
- [ ] Configure the worker
	- [ ] Configure environment variables
	- [ ] Hyperdrive
- [ ] Business card: Chase Ink Business Unlimited

## List of screens to make

Keep iterating on the "create a screen" skill.

- [ ] Client
- [ ] Project list
- [ ] Crews
- [ ] Customer-facing: Invoice
- [ ] Customer-facing: Proposal
- [ ] Customer-facing: Work Order
- [ ] Estimating
- [ ] Foreman/project check-in
- [ ] Create a lead
- [ ] Project
- [ ] Scheduling: week/all jobs
- [ ] Scheduling: day
- [ ] Settings



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
