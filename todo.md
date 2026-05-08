## bitty things soon

- function to iterate over query data structure and add `AND company_id = ?` clauses
- change how table/column/alias names are passed to the query builder, use strings: https://claude.ai/chat/591c124d-2cc3-439d-b6c5-10918741e0c5

## higher level

- dev server
- deployable?  maybe
- client with ASR+context
- a few actual endpoints e.g. login
- most hacky bullshit auth ever
- ability to call "server functions" via api
- query function that runs safe sql queries
	- company_id mandatory
- that's it, start building ui

## "Server functions"

- how should nesting work?
- maybe its own directory?
- globbed up somehow to package up for the server
- types generated for use in the client

- a directory full of modules that export functions that can be "called" from the client
	- generate the types of all the functions and export them somewhere accessible by the client
		- functions take a single argument
		- argument defined/validated by json validator
		- optional permissions function that takes the user and a permissions object and returns true/false
	- client-side, generate a function for each of those server-side functions, that can be called with the signature of the server-side function, that makes a query to a `function` endpoint with everything relevant as the body
	- server-side `function` endpoint that uses the validator to validate the argument, then calls the underlying function and returns the value

## Cloudflare Workers / wrangler

- [ ] Create Cloudflare account at dash.cloudflare.com (if not done)
- [ ] Run `pnpm wrangler login` to authenticate the CLI (one-time per machine)
- [ ] First `pnpm deploy` will auto-create the Worker and prompt for a `*.workers.dev` subdomain (one-time per account)
- [ ] Build real worker code to `build/worker/worker.js` before deploying (replace dummy)
- [ ] Configure custom domain via Cloudflare dashboard or `routes` in `wrangler.toml` when ready

Local dev (no account needed): `pnpm dev`

