environment

```sh
nvm use
corepack install
```

## Schema notes

A project being "closed" does not mean that it is paid, payments are a broader system than the project/work system.

## Wrangler production configuration

No environment variables for database secrets since using hyperdrive.

```sh
npx wrangler hyperdrive create treebzns-prod \
        --scheme mysql \
        --host HOST \
        --port PORT \
        --database treebzns_prod \
        --user treebzns_cfw \
        --password 'PASSWORD' \
        --caching-disabled
```

Photos live in a DigitalOcean Spaces bucket.  `SPACES_REGION` is in `[vars]` in `wrangler.toml`.  Set the bucket and the bucket's access key as secrets:

```sh
npx wrangler secret put SPACES_BUCKET
npx wrangler secret put SPACES_ACCESS_KEY_ID
npx wrangler secret put SPACES_SECRET_ACCESS_KEY
```

## Local environment variables

`.env` holds local values.  `.env.example` lists every name.  Wrangler dev and the scripts read `.env`, and `.env` values override `[vars]` in local dev.

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DB`, `MYSQL_USER`, `MYSQL_PASS`, `MYSQL_CA_CERT`: the local database.  Production uses Hyperdrive instead.
- `SPACES_REGION`: the Spaces region, e.g. `nyc3`.
- `SPACES_BUCKET`: the Spaces bucket.  Use a separate bucket for local dev.
- `SPACES_ACCESS_KEY_ID`, `SPACES_SECRET_ACCESS_KEY`: an access key limited to that bucket.

After you add a variable, run `pnpm run regenerate_worker_types` so `Env` includes it.  Run `pnpm run smoke:spaces` to check the Spaces values against the live bucket.

To dump some local data

```sh
npx dotenv -- node scripts/dump_company_inserts.ts --company_id [N]
```
