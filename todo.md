- function to iterate over query data structure and add `AND company_id = ?` clauses
- a directory full of modules that export functions that can be "called" from the client
	- generate the types of all the functions and export them somewhere accessible by the client
		- functions take a single argument
		- argument defined/validated by json validator
		- optional permissions function that takes the user and a permissions object and returns true/false
	- client-side, generate a function for each of those server-side functions, that can be called with the signature of the server-side function, that makes a query to a `function` endpoint with everything relevant as the body
	- server-side `function` endpoint that uses the validator to validate the argument, then calls the underlying function and returns the value
- a select_query endpoint that takes the shape of a safe query, and iterates over it adding `AND company_id = ?` to every relevant clause

## Cloudflare Workers / wrangler

- [ ] Create Cloudflare account at dash.cloudflare.com (if not done)
- [ ] Run `pnpm wrangler login` to authenticate the CLI (one-time per machine)
- [ ] First `pnpm deploy` will auto-create the Worker and prompt for a `*.workers.dev` subdomain (one-time per account)
- [ ] Build real worker code to `build/worker/worker.js` before deploying (replace dummy)
- [ ] Configure custom domain via Cloudflare dashboard or `routes` in `wrangler.toml` when ready

Local dev (no account needed): `pnpm dev`

## export types and metadata from schema

Data used to validate queries are reasonable server-side.

Identifiers in the data can be referenced directly when building queries.

The type of the data can be used to type-check queries as they are written.

```ts

```
