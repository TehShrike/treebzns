# scripts/investigate_arbostar/

One-off reports over the data in [`arbostar_export/`](../../arbostar_export/readme.md). Each
script reads the exported `.js` modules directly. Nothing touches the database.

```sh
node scripts/investigate_arbostar/totals.ts                    # invoice + payment grand totals
node scripts/investigate_arbostar/customer_balances.ts         # per-customer invoiced / paid / balance
node scripts/investigate_arbostar/payments_without_invoices.ts # payments with no invoice, and why
```

The exports are snapshots taken on different days. Rows created between two export runs show
up as gaps: a payment can reference an estimate or client that is not in the older export
yet. The scripts label these instead of failing. Regenerate all the exports together (see
the arbostar_export readme) before you trust cross-dataset joins.
