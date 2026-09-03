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

To dump some local data

```sh
npx dotenv -- node scripts/dump_company_inserts.ts --company_id [N]
```
