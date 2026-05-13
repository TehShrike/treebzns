## bitty things soon

- function to iterate over query data structure and add `AND company_id = ?` clauses
- change how table/column/alias names are passed to the query builder, use strings: https://claude.ai/chat/591c124d-2cc3-439d-b6c5-10918741e0c5

## knock out

- deploy worker + static assets, serve a `public` directory
- build worker with esbuild, look at instantestimate
- client app
	- build with esbuild
	- abstract-state-router
- client-side: a fetchy function for making requests
- client-side: a server-function api – object with properties that look like server-functions - backed by a request to a `fn` endpoint
- bare login endpoint that sets a cookie
- server-side handling of `fn` endpoint: check the cookie, look up the user, look for the function, validate the argument

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

## Cloudflare Workers / wrangler

- [x] Create Cloudflare account at dash.cloudflare.com (if not done)
- [x] Run `pnpm wrangler login` to authenticate the CLI (one-time per machine)
- [x] First `pnpm deploy` will auto-create the Worker and prompt for a `*.workers.dev` subdomain (one-time per account)
- [ ] Build real worker code to `build/worker/worker.js` before deploying (replace dummy)
- [ ] Configure custom domain via Cloudflare dashboard or `routes` in `wrangler.toml` when ready

Local dev (no account needed): `pnpm dev`

