# Invoices and payments plan (2026-08-12)

Design discussion: https://claude.ai/share/f760a718-831a-413f-b700-733345c0ef90

## Status (end of 2026-08-12 session)

The schema sections below are settled except for the items in "Open questions". Work
remaining, in order:

1. Answer the one remaining open question: customer credit (it likely adds two tables).
2. Fold the answers into the schema sections.
3. Write the "ArboStar import changes" section at the bottom. Useful inputs for it: the
   current import lives in `src/shared/arbostar/import_payments.ts` (payments → `payment` +
   the old `payment_project`, allocations resolved estimate → lead → project), and the
   investigation scripts in `scripts/investigate_arbostar/` show the data's shape —
   906 invoices, 1,204 payments, 63 payments not tied to any invoice (deposits on
   uninvoiced or declined estimates), header-level discounts totaling $16,764.56 that must
   map to our discount model, plus tips and merchant fees that now have columns.
4. Hand the finished plan to an implementing agent.

Not in scope here: statement/report screens, credit memos beyond the customer-credit
question, refund payouts.

## Decisions carried in from the discussion

- Projects carry no accounts-receivable semantics. Only invoices and payments touch the
  customer balance.
- Customer balance = sum of the client's invoice totals minus sum of the client's payment
  amounts. Statements and "amount due" views are reports over that, never documents.
- Down payments are not invoices. A down payment is a payment allocated to a project. It
  sits as unapplied credit until an invoice exists to absorb it. This models the deposit as
  a liability, which is also the accounting-correct shape.
- When a `represents_billable_sale_when_closed` project closes, an invoice is created. An
  invoice can also be created earlier, for a subset of the project's line items.
- Invoice line items link to project line items optionally, and carry their own amounts.
  That allows partial billing of a line, several project lines on one invoice, one project
  line across several invoices, and fee lines (cancellation/forfeiture) that link to no
  project line.
- Billing invariant, enforced in app code: for one project line item, the sum of linked
  invoice line amounts must stay ≤ the project line's total while the project is open, and
  must equal it when the project closes. (The ≤-while-open half and the edit-blocking rule
  below were later relaxed — see the decided list.)
- Editing a project line item below its already-billed sum is blocked. (Relaxed — see the
  decided list.)
- Tax is computed against the sum of the taxable lines on the invoice, not per line. Same
  scheme the project uses.
- Cancellation with a kept deposit: create an invoice with a fee line (no project line
  link), then apply the deposit's credit to that invoice.

Decided 2026-08-12:

- No hard delete of invoices. Voiding is a `voided_at` timestamp.
- `due_date` is a plain date column, prefilled from a new `company.invoice_due_after_days`
  setting (default 30).
- Payments get a `tip` column.
- Discounts have two exclusive modes per document: a header `discount` number, or per-line
  discounts whose sum is stored as `line_item_discount_subtotal`. At most one of the two
  columns is non-null, enforced by the manual TypeScript type override. A line discount is
  a `discount_rate` (a ratio of the line's gross amount) or a flat `discount` dollar
  amount. At most one of the two is non-null, also enforced by the type override. Both null
  is valid and means no discount — neither is required.
- The same discount columns go on `project` and `project_line_item`, so estimates can show
  discounts and the billing invariant compares post-discount amounts on both sides.
- Invoices get a `fee` number.
- Payments get `merchant_fee` (informational), `notes`, and `recorded_by_employee_id`.
- A payment links to at most one project, via a nullable `payment.project_id`. The
  `payment_project` table is dropped. Payments still link to any number of invoices through
  `payment_invoice`.
- Invoices snapshot the client's billing name and address at creation time, in `billing_`-
  prefixed columns. The job/project address is not snapshotted — it lives on the project.
- Refunds need no schema: model a refund as an invoice with negative lines when the need
  arises.
- Invoice immutability: the lean is immutable once the first payment is applied. The exact
  freeze point is deferred — it is app logic, not schema.
- Calculation formulas live in `invoice_calculation.md`. The schema stores what it names:
  `subtotal`, `taxable_subtotal`, `line_item_discount_subtotal`, `tax_total`, `total`.
- All discounts are pre-tax. The invoice-level `discount` is capped at `subtotal`, comes
  off the taxable subtotal first (clamped at 0 — no proration across taxable and
  non-taxable lines), and is not allowed on a negative-subtotal invoice. Negative taxable
  subtotals (refund invoices) keep their sign so tax is refunded.
- `subtotal` = the sum of the line item totals (each net of its own discount). It matches
  the printed line-total column in both discount modes.
- Both `invoice_line_item` and `project_line_item` get a `sort` column.
- A project header discount spreads across the project's invoices: each partial invoice
  takes a roughly proportional share (its share of the project subtotal, rounded), stored
  as that invoice's own `discount`. The final resolving invoice takes whatever discount
  remains, so rounding can never strand or double a cent. Project close validates that the
  invoices' discounts sum to the project's discount.
- Over-billing is not hard-blocked, and editing a project line below its billed sum is
  allowed. A project line has a billed balance: its net amount minus its linked invoice
  lines' net amounts. The balance may go negative mid-project. The committed rule is only
  at close: the final invoice resolves every line's remaining balance, including negative
  balances as negative linked lines, so every balance ends at zero. A mid-project ≤ cap
  may be added later as UI guidance.
- Invoice `fee` is post-tax, never tied to regular line items, and exists only on
  invoices — no project-side fee. Today it is a hand-entered number, most obviously for
  card surcharges passed to the customer. Later, fee calculation algorithms may attach to
  payment methods, and fee line items may exist. Either way fees stay post-tax.

## New table: invoice

```sql
CREATE TABLE invoice (
	invoice_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	number INT UNSIGNED NOT NULL,
	client_id INT UNSIGNED NOT NULL,
	project_id INT UNSIGNED,
	billing_name VARCHAR(500) NOT NULL,
	billing_address_line_1 VARCHAR(500) NOT NULL,
	billing_address_line_2 VARCHAR(500) NOT NULL,
	billing_city VARCHAR(100) NOT NULL,
	billing_state VARCHAR(50) NOT NULL,
	billing_zip VARCHAR(20) NOT NULL,
	invoice_date DATE NOT NULL,
	due_date DATE NOT NULL,
	taxable BIT(1) NOT NULL,
	tax_rate_id INT UNSIGNED,
	tax_rate DECIMAL(4,4),
	subtotal DECIMAL(10,2) NOT NULL,
	taxable_subtotal DECIMAL(10,2) NOT NULL,
	discount DECIMAL(10,2),
	line_item_discount_subtotal DECIMAL(10,2),
	tax_total DECIMAL(10,2) NOT NULL,
	fee DECIMAL(10,2) NOT NULL DEFAULT 0,
	total DECIMAL(10,2) NOT NULL,
	voided_at DATETIME,
	created_by_employee_id INT UNSIGNED,
	arbostar_invoice_id INT UNSIGNED,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (invoice_id),
	UNIQUE KEY uq_invoice_company_number (company_id, number),
	INDEX idx_invoice_client (client_id),
	INDEX idx_invoice_project (project_id),
	UNIQUE KEY uq_invoice_company_arbostar_invoice_id (company_id, arbostar_invoice_id)
) ENGINE=InnoDB;
```

Notes:

- `number` is the customer-facing invoice number, sequential per company. Allocate it the
  same way project numbers work: an `invoice_number` table with `company_id` and
  `next_number`, mirroring `project_number`.
- `taxable` / `tax_rate_id` / `tax_rate` follow the project's pattern exactly. The tax
  fields are null exactly when `taxable` is 0. Add the same discriminated-union override in
  `schema/type/invoice.d.ts` that `project.d.ts` has.
- Unlike the project's nullable totals, `subtotal` / `tax_total` / `total` are NOT NULL. An
  invoice is born whole. They are stored snapshots, not live sums, so the document cannot
  drift after the fact.
- `subtotal` is the sum of the lines' totals, each net of its own discount. It is what the
  printed line-total column adds up to. The header `discount` is not subtracted from it.
- `taxable_subtotal` is the stored sum of the taxable lines' totals, before the header
  `discount`. The actual tax base subtracts the header discount from it, clamped at 0
  (sign-preserved when it is negative) — see `invoice_calculation.md` for the exact
  formulas. `tax_total` stores the result, so no consumer recomputes it.
- Discounts have two exclusive modes. `discount` is a header-level dollar amount with no
  line detail. `line_item_discount_subtotal` is the stored sum of the lines' discount
  amounts. At most one is non-null — both null means no discount. The
  manual override in `schema/type/invoice.d.ts` makes the pair a discriminated union, like
  the tax fields:
  `{ discount: FinancialNumber; line_item_discount_subtotal: null } |
  { discount: null; line_item_discount_subtotal: FinancialNumber | null }`.
- `fee` is a dollar amount added on top (card surcharge and the like). It is NOT NULL
  DEFAULT 0 because a null fee and a zero fee would mean the same thing. No line represents
  it, and it is not taxed (flagged as an assumption below).
- `total` = `subtotal` − (`discount` capped at `subtotal`, or 0) + `tax_total` + `fee`.
  Line discounts are already inside `subtotal`, so `line_item_discount_subtotal` never
  subtracts here — it is informational ("you saved X"). In header-discount mode it is
  NULL, even though the doc's formula would yield 0 — the XOR wins.
- `project_id` is null for invoices not tied to one project (a cancellation fee is still
  tied to a project, but a misc charge may not be). When every line links to a project line,
  `project_id` is redundant with the lines. Keep it anyway — it is the natural filter for
  "invoices for this project" and it covers invoices whose lines have no project line links.
- `created_by_employee_id` is nullable because imported invoices have no author.
- The `billing_` columns snapshot the client's billing details at invoice creation: the
  client's `name` and the address row named by `client.billing_client_address_id` (falling
  back to the primary address). Column types mirror `client` / `client_address`. They are
  NOT NULL with '' for absent parts, per the empty-string convention. Later client edits do
  not change existing invoices. The snapshot is the billing identity only — the job address
  stays on the project.
- Negative lines are allowed. A refund or credit is an invoice with negative lines. The
  line-discount caps apply only to positive lines.
- `voided_at` marks a dead invoice. A voided invoice keeps its number and its rows, but
  drops out of every balance and billed-amount sum. App rules: voiding is blocked while the
  invoice has `payment_invoice` allocations (release them first), and voiding releases the
  billed amounts so the project lines count as unbilled again.
- Index note (per the company_id-in-indexes rules): `client_id` and `project_id` are
  globally unique ids, so their indexes take no `company_id` prefix. `number` and
  `arbostar_invoice_id` repeat across companies, so those unique keys lead with
  `company_id`, matching `uq_project_company_number` and the other arbostar-id keys.

## New table: invoice_number

Mirrors `project_number` (post-0029 shape: `next_number`, default 1). One row per company,
created alongside the company. Allocation increments `next_number` inside the
invoice-creating transaction, the same way project numbering works.

```sql
CREATE TABLE invoice_number (
	invoice_number_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	next_number INT UNSIGNED NOT NULL DEFAULT 1,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (invoice_number_id),
	UNIQUE KEY uq_invoice_number_company (company_id)
) ENGINE=InnoDB;
```

The migration seeds a row for every existing company. Company creation code inserts one for
new companies.

## Company change

```sql
ALTER TABLE company
	ADD COLUMN invoice_due_after_days INT UNSIGNED NOT NULL DEFAULT 30;
```

The new-invoice flow prefills `due_date` as `invoice_date + invoice_due_after_days`. The
author can override the date per invoice.

## New table: invoice_line_item

```sql
CREATE TABLE invoice_line_item (
	invoice_line_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	invoice_id INT UNSIGNED NOT NULL,
	project_line_item_id INT UNSIGNED,
	description VARCHAR(200) NOT NULL,
	quantity DECIMAL(10,2) NOT NULL,
	price DECIMAL(10,2) NOT NULL,
	discount_rate DECIMAL(5,4),
	discount DECIMAL(10,2),
	taxable BIT(1) NOT NULL,
	sort INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (invoice_line_item_id),
	INDEX idx_ili_invoice (invoice_id),
	INDEX idx_ili_project_line_item (project_line_item_id)
) ENGINE=InnoDB;
```

Notes:

- `quantity` and `price` are DECIMAL(10,2) to match `project_line_item`.
- A line's gross amount is `quantity × price`. Its discount amount is
  `discount_rate × gross` (rounded to 2 places) when the rate is set, `discount` when the
  flat amount is set, else 0. Its net amount is gross minus the discount amount. All of
  these are derived, never stored. Use financial-number and round to 2 places the same way
  project totals are computed.
- `discount_rate` and `discount` are exclusive modes, like the invoice's header pair: a
  rate discount is a ratio of the line's gross amount, a flat discount is a dollar amount.
  At most one is non-null — both null means no discount. DECIMAL(5,4) allows a rate of
  exactly 1.0000 (a fully-comped line). App code caps the rate at 1 and caps `discount` at
  the gross amount. The manual type override:
  `{ discount_rate: FinancialNumber; discount: null } |
  { discount_rate: null; discount: FinancialNumber | null }`.
- Line discounts are only allowed when the invoice has no header `discount` (the exclusive
  modes above). When any line has one, the invoice stores the sum of the lines' discount
  amounts as `line_item_discount_subtotal`.
- The sum of the taxable lines' net amounts is stored on the invoice as
  `taxable_subtotal` — line discounts reduce tax. A header `discount` also reduces the tax
  base (clamped at 0) per `invoice_calculation.md`.
- A project line's billed balance is its net amount minus the sum of its linked invoice
  lines' net amounts (grouped by `project_line_item_id`). Mid-project the balance may be
  positive or negative — nothing blocks over-billing or downward project-line edits. Close
  drives every balance to zero through the final invoice.
- `sort` fixes the display order. `project_line_item` gets the same column (see the
  project-side section).
- Partial billing has two possible shapes: quantity 0.5 at full price, or full quantity at
  half price. The schema supports both. The invoice-creation UI should pick one convention
  (suggest: keep the project line's price, reduce quantity) so descriptions read sensibly.

## Project-side discount columns

The same discount model goes on the project, so estimates can show discounts and the
billing invariant compares post-discount amounts on both sides.

```sql
ALTER TABLE project
	ADD COLUMN taxable_subtotal DECIMAL(10,2) AFTER subtotal,
	ADD COLUMN discount DECIMAL(10,2) AFTER taxable_subtotal,
	ADD COLUMN line_item_discount_subtotal DECIMAL(10,2) AFTER discount;

ALTER TABLE project_line_item
	ADD COLUMN discount_rate DECIMAL(5,4) AFTER price,
	ADD COLUMN discount DECIMAL(10,2) AFTER discount_rate,
	ADD COLUMN sort INT UNSIGNED AFTER discount;
```

Backfill `sort` from id order per project, then make it NOT NULL.

- Same rules as the invoice: header `discount` and `line_item_discount_subtotal` are
  exclusive, and a line's `discount_rate` and `discount` are exclusive.
- `taxable_subtotal` has the same meaning as the invoice's. It is nullable like the
  project's other stored totals.
- Update the manual overrides in `schema/type/project.d.ts` and
  `schema/type/project_line_item.d.ts` with the same discriminated unions the invoice
  types get.
- Project `total` = `subtotal` − (`discount` or 0) + `tax_total`. Projects have no fee.
  Same formulas as the invoice (`invoice_calculation.md`), minus the fee term.

## Payment changes

The `payment` table already exists (client-level: `client_id`, `amount`, `pay_date`,
`payment_method_id`, `arbostar_payment_id`). It stays the balance-affecting record. Its
`amount` is what subtracts from the customer balance.

New columns:

```sql
ALTER TABLE payment
	ADD COLUMN project_id INT UNSIGNED AFTER client_id,
	ADD COLUMN tip DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER amount,
	ADD COLUMN merchant_fee DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER tip,
	ADD COLUMN notes VARCHAR(500) NOT NULL DEFAULT '' AFTER payment_method_id,
	ADD COLUMN recorded_by_employee_id INT UNSIGNED AFTER notes,
	ADD INDEX idx_payment_project (project_id);
```

- `project_id` is the down-payment link: a payment optionally belongs to one project. It
  carries no amount. It never moves and never clears — after the project is invoiced and
  the money is applied through `payment_invoice`, it remains as provenance ("this arrived
  as the deposit on project X"). Because it carries no amount, it can never double-count
  against invoice allocations.
- `tip` is money received that is not payment for work. It is excluded from `amount`, from
  the customer balance, and from allocations. The ArboStar export carries $5,934.41 of
  tips.
- `merchant_fee` is informational: what the card processor took. It does not enter any
  balance math. ArboStar sometimes charges the fee on top of the payment and sometimes
  deducts it from it — either way `amount` stays the money that reduces the balance, and
  `merchant_fee` just records the cost. The export carries $11,925.20 of fees.
- `notes` and `recorded_by_employee_id` mirror ArboStar's payment notes and author.
  `recorded_by_employee_id` is nullable for imported and system-recorded payments.

Drop the `payment_project` table. Every row in it is import-managed, and the re-import
fills `payment.project_id` instead. The migration drops the table outright.

New allocation table:

```sql
CREATE TABLE payment_invoice (
	payment_invoice_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	payment_id INT UNSIGNED NOT NULL,
	invoice_id INT UNSIGNED NOT NULL,
	amount DECIMAL(12,2) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (payment_invoice_id),
	UNIQUE KEY uq_payment_invoice (payment_id, invoice_id),
	INDEX idx_payment_invoice_invoice (invoice_id)
) ENGINE=InnoDB;
```

- Allocation invariant, app-enforced: for one payment, sum of `payment_invoice.amount` ≤
  `payment.amount`. The remainder is the payment's unapplied credit. When the payment has a
  `project_id`, the unapplied credit is understood to be waiting for that project's
  invoices.
- When an invoice is created for a project, the flow finds the client's payments with that
  `project_id` and unapplied credit, and inserts `payment_invoice` rows applying them (up
  to the invoice total). The payment rows themselves never change.

### Per-invoice and per-customer derived values

- Invoice amount paid = sum of its `payment_invoice.amount`. Invoice balance due =
  `total` − amount paid. Not stored — derived. Add a denormalized paid/open flag later only
  if list screens need it.
- Customer balance = sum(invoice.total) − sum(payment.amount). Allocations never enter the
  balance — they only say which invoices are still open and which money is earmarked.

## Project-close validation

Closing a `represents_billable_sale_when_closed` project requires:

- Every non-declined line item is done (`done_at` set).
- Every non-declined line item's billed balance is zero: linked invoice lines' net amounts
  equal the project line's net amount (gross minus its discount).
- When the project has a header discount: the invoices' `discount` values sum to the
  project's `discount`. The final invoice takes the remainder (see the decided list), so
  this holds by construction.

The close flow creates the final resolving invoice for every line's remaining balance —
negative balances (over-billed or edited-down lines) become negative linked lines — then
applies the client's payments that carry the project's `project_id` and still have
unapplied credit. Declined (`client_declined`) lines bill nothing and block nothing.

Edge to handle in the close flow: the final invoice can have a negative subtotal (mostly
negative balances), and `invoice_calculation.md` forbids an invoice-level discount there.
When header discount remains and the final invoice's subtotal would be negative, the flow
must either distribute that discount onto an earlier invoice or split the true-up.

## Open questions and suggested extra columns

1. **Customer credit.** We need an explicit credit concept and a way to apply credit to
   invoices. Unapplied payment money already acts as credit, but it only covers money the
   client actually sent. A goodwill credit ("$100 off your next invoice"), an adjustment,
   or a forfeited-deposit true-up is not money received, so faking it as a payment would
   corrupt "sum of payments = money received". Sketch of the likely shape, to be designed:
   - A `credit` table: client-level document with `amount`, a date, `notes` / reason,
     `created_by_employee_id`, maybe a nullable `project_id`.
   - A `credit_invoice` allocation table mirroring `payment_invoice`.
   - Customer balance becomes sum(invoices) − sum(payments) − sum(credits). Invoice
     balance due subtracts both payment and credit allocations.
   - Credits are post-tax dollars, like payments — no tax fields.
   To figure out: naming, whether a credit can be voided, whether the cancellation flow
   should mint credits, and whether an unapplied payment remainder ever converts into a
   credit record (probably not — it already works as credit).

## ArboStar import changes

To be written once the open questions are settled. Known shape of the work:

- Import ArboStar invoices into `invoice` + `invoice_line_item` (line items come from
  `line_items.js` rows carrying an `invoice_id`). ArboStar's header `discount` maps to our
  header `discount` mode.
- Payment allocations with an `invoice_id` become `payment_invoice` rows. Estimate-only
  allocations (deposits) become `payment.project_id` via estimate → lead → project.
- `payment_tips` → `tip`, `payment_fee` → `merchant_fee`, `payment_notes` → `notes`,
  `payment_author` → `recorded_by_employee_id`.
- Delete `import_payments.ts`'s payment_project reconciliation.
- Normalize all ArboStar numbers with `#shared/arbostar/arbostar_number_to_fnum.ts`.
