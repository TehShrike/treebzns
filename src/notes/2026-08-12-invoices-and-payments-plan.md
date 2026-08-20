# Invoices and payments plan (2026-08-12)

Design discussion: https://claude.ai/share/f760a718-831a-413f-b700-733345c0ef90

## Status (as of 2026-08-20)

Schema change since this plan was written: invoices no longer carry `billing_` columns.
They moved to `client` (migrations 0045–0046) — the client is the billable account, and
invoices follow the account. The invoice DDL below predates that change.

Implemented and verified: migrations 0038–0040 (applied locally), the type overrides and
validators, `import_invoices.ts`, and the changes to the line-item, payment, and project
importers. The full import ran against the live export for company 9. Every invoice
`total` matches ArboStar's `total_including_tax` (936,090.07 in both). The one fee
invoice, the allocator bump to 100,000, and the tier counts all check out. The current
export resolves invoice 00529-I at tier 3 — it gained reconciling line rows since the
snapshot below. Also built since: the calculation code
(`src/shared/invoice/calculate_invoice.ts` with tests, `least_of` in fnum).

Not built yet: SUM in the query builder, the invoice-creation server function, and the
project close flow (see "Project-close validation" and "Deferred to the app/UI phase").
UI comes later. Also not in scope: statement/report screens, refund payouts, voiding
(pulled until a real-world case shows up).

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

- No hard delete of invoices, and no voiding for now (pulled until a real-world case shows
	up). An incorrect invoice is cancelled by a refunding invoice with negative lines.
- Invoices are immutable and permanent from the moment they are created. There is no
	draft, open, or void state. The only "open" thing about an invoice is its unpaid
	balance, which payments affect.
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
- Invoices carry no billing address (decided 2026-08-20). The client record is a billable
	account with one unambiguous billing address, in `client.billing_`-prefixed columns.
	Invoices follow the billing account. Mailed bills will be modeled later, and may
	serialize the address they were sent to. The job/project address lives on the project.
- Refunds need no schema: model a refund as an invoice with negative lines when the need
	arises.
- Client credit: granted as rows in a new `client_credit` table, applied automatically and
	pre-tax when an invoice is created, per `invoice_calculation.md`. The applied amount is
	serialized to `invoice.client_credit_applied` — there is no allocation table, the
	invoice record itself is the allocation. Available credit is a client-level pool:
	sum(`client_credit.amount`) − sum(`invoice.client_credit_applied`). Credit therefore
	only reaches invoices created after it is granted. The UI may later grow levers that
	feed the application algorithm. Cash payments never affect credit — credit is another
	form of discount, not money. (The calculation doc says "customer credit" — the schema
	uses the `client` prefix, matching every other table.)
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

Decided 2026-08-13 (import behavior):

- The one non-negotiable: imported `invoice.total` must equal ArboStar's
	`total_including_tax` — the number that affected the customer's balance in ArboStar.
	Other derived columns may be approximate.
- Imported invoices get `due_date` = `invoice_date + company.invoice_due_after_days`.
- The import trusts ArboStar's header totals. Line items import as they were exported, and
	totals are never recalculated from them.
- `invoice_number` is constructed from ArboStar's `invoice_no`: lead number × 10 plus the
	suffix, 0 when there is no suffix (`02019-I-1` → 20191, `01434-I` → 14340). After
	import, `invoice_number.next_number` moves to the next power of 10 above the largest
	constructed number.
- The importer overwrites invoices it originally imported (rows with an
	`arbostar_invoice_id`). App-created invoices are never touched.
- `created_by_employee_id` stays null on imported invoices. The `estimator` name is not
	mapped.
- `taxable_subtotal` uses the tiered derivation in the import section.
- The import will run for many ArboStar tenants. The counts and examples in this document
	come from one tenant's export and only validate the rules. Do not hardcode them (the
	5.5% rate, the number ranges, specific invoices).

## New table: invoice

```sql
CREATE TABLE invoice (
	invoice_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	invoice_number INT UNSIGNED NOT NULL,
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
	client_credit_applied DECIMAL(10,2) NOT NULL DEFAULT 0,
	tax_total DECIMAL(10,2) NOT NULL,
	fee DECIMAL(10,2) NOT NULL DEFAULT 0,
	total DECIMAL(10,2) NOT NULL,
	created_by_employee_id INT UNSIGNED,
	arbostar_invoice_id INT UNSIGNED,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (invoice_id),
	UNIQUE KEY uq_invoice_company_number (company_id, invoice_number),
	INDEX idx_invoice_client (client_id),
	INDEX idx_invoice_project (project_id),
	UNIQUE KEY uq_invoice_company_arbostar_invoice_id (company_id, arbostar_invoice_id)
) ENGINE=InnoDB;
```

Notes:

- `invoice_number` is the customer-facing invoice number, sequential per company. Allocate it the
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
- `total` = `subtotal` − (`discount` capped at `subtotal`, or 0) − `client_credit_applied`
	+ `tax_total` + `fee`, per `invoice_calculation.md` (its `total_price_reduction` is the
	discount plus the applied credit). Line discounts are already inside `subtotal`, so
	`line_item_discount_subtotal` never subtracts here — it is informational ("you saved
	X"). In header-discount mode it is NULL, even though the doc's formula would yield 0 —
	the XOR wins.
- `project_id` is null for invoices not tied to one project (a cancellation fee is still
	tied to a project, but a misc charge may not be). When every line links to a project line,
	`project_id` is redundant with the lines. Keep it anyway — it is the natural filter for
	"invoices for this project" and it covers invoices whose lines have no project line links.
- `created_by_employee_id` is nullable because imported invoices have no author.
- The `billing_` columns live on `client`, not on `invoice` (decided 2026-08-20). The
	client is the billable account, and an account has one unambiguous billing address.
	Column types mirror `client_address`. They are NOT NULL with '' for absent parts, per
	the empty-string convention. Invoices read the account's billing details when rendered.
	Mailed bills will be modeled later, and may serialize the address they were sent to.
	The job address stays on the project.
- Negative lines are allowed. A refund is an invoice with negative lines, and so is the
	cancellation of an incorrect invoice — there is no voiding or editing. The line-discount
	caps apply only to positive lines.
- `client_credit_applied` is the credit consumed by this invoice, computed once at
	creation (`invoice_calculation.md`) and serialized here. The invoice record itself is
	the allocation — no allocation table. NOT NULL DEFAULT 0 because "no credit applied" and
	0 are the same thing.
- Index note (per the company_id-in-indexes rules): `client_id` and `project_id` are
	globally unique ids, so their indexes take no `company_id` prefix. `invoice_number` and
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

## New table: client_credit

Credit grants. Consumption is not tracked per grant — available credit is a client-level
pool: sum of these rows minus sum of the client's invoices' `client_credit_applied`. An
adjustment or revocation is just another row, positive or negative.

```sql
CREATE TABLE client_credit (
	client_credit_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	company_id INT UNSIGNED NOT NULL,
	client_id INT UNSIGNED NOT NULL,
	amount DECIMAL(10,2) NOT NULL,
	notes VARCHAR(500) NOT NULL DEFAULT '',
	created_by_employee_id INT UNSIGNED NOT NULL,
	created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	PRIMARY KEY (client_credit_id),
	INDEX idx_client_credit_client (client_id)
) ENGINE=InnoDB;
```

- `notes` is the reason for the grant. `created_by_employee_id` is NOT NULL — every grant
	has an author. If system-granted credit ever needs it, make it nullable then.
- Credit application happens only inside invoice creation. The availability query must
	run in the same transaction that inserts the invoice.
- Granting credit never touches existing invoices or the customer balance. It only
	reduces future invoices.
- A refunding invoice that cancels an incorrect invoice does not return the credit the
	original consumed (negative-subtotal invoices apply no credit, and applied amounts are
	immutable). The cancel flow must re-grant that amount as a new `client_credit` row.

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
	the customer balance, and from allocations.
- `merchant_fee` is informational: what the card processor took. It does not enter any
	balance math. ArboStar sometimes charges the fee on top of the payment and sometimes
	deducts it from it — either way `amount` stays the money that reduces the balance, and
	`merchant_fee` just records the cost.
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

## Open questions

Design questions: none. Every design question is resolved into the decided list and the
schema sections above. Client credit landed differently than the early sketch here once
suggested: it is a pre-tax reduction applied at invoice creation (see the `client_credit`
section and `invoice_calculation.md`), not a balance-affecting document with allocations.
Implementation questions from the 2026-08-13 research are collected in the last section.

## ArboStar import changes

Verified 2026-08-13 against the current export with `scripts/investigate_arbostar/` plus
one-off checks. The export holds 906 invoices, 1,204 payments, and 1,351 allocations.

Data facts the import can rely on:

- `total_for_services` is net of the header discount. `total_including_tax =
	total_for_services + tax` holds on 905 of 906 invoices. On discounted invoices with
	complete line rows, `sum(line gross) − discount = total_for_services` (51 of the 59
	discounted invoices — the rest have missing or partial line rows). So our pre-discount
	`subtotal` = `total_for_services + discount`.
- The one exception is invoice 00115-I. Its `total_including_tax` exceeds
	`total_for_services + tax` by 93.14 (a passed-through surcharge). That difference maps
	to our post-tax `fee`.
- The export's calculated `amount` field equals `payment_amount − payment_tips` on all
	1,204 payments.
- Line rows do not reliably reconstruct invoices. 63 invoices have no line rows, and about
	70 more have zero-amount or partial rows that do not sum to the header totals. Header
	totals are authoritative.
- 278 invoices have tax. 271 imply exactly the 5.5% rate on `total_for_services`. The
	other 7 deviate, consistent with their `non_taxable` lines and discounts changing the
	base. Rate inference works: match the implied rate to the imported `tax_rate` rows.
- 1,288 of the 1,351 allocations carry an `invoice_id`. 2 point at invoices missing from
	the export (skip and count). 15 reference estimates missing from the export.
- 62 payments have estimate-only allocations, plus 1 mixed. No estimate-only payment spans
	more than one lead, so the single `payment.project_id` column suffices for deposits.
- `payment_author` is 0 on 670 payments and null on 19 — both mean the system. The rest
	map to three real users, all active and importable.
- 26 leads have two invoices (partial billing exists), 4 of them with discounts.

### New importer: import_invoices.ts

Runs after `import_line_items` and before `import_payments`. New phase order: employees /
clients / work skills in parallel, then projects, then line items, then invoices, then
payments. (Line items and payments currently run in parallel. Invoice lines need the
line-item correlations, and payment allocations need the invoice ids.)

Correlate on `arbostar_invoice_id`, like every other importer. Add the map to
`load_existing_correlations.ts`. Existing rows update, new rows insert, vanished rows are
counted and kept.

| invoice column | source |
| --- | --- |
| `arbostar_invoice_id` | `invoice_id` |
| `invoice_number` | constructed from `invoice_no` — see below |
| `client_id` | `client_id` through the imported-clients map |
| `project_id` | `lead_id` → project map |
| `invoice_date` | `date_created` |
| `due_date` | `invoice_date + company.invoice_due_after_days` |
| `billing_*` | snapshot of the imported client's name and billing/primary address |
| `subtotal` | `money(total_for_services) + money(discount)` |
| `taxable_subtotal` | derived — see below |
| `discount` | `money(discount)`, null when zero |
| `line_item_discount_subtotal` | always null (ArboStar has no line discounts) |
| `client_credit_applied` | 0 |
| `taxable` / `tax_rate_id` / `tax_rate` | `tax != 0`, rate matched to imported `tax_rate` rows |
| `tax_total` | `money(tax)` |
| `fee` | `money(total_including_tax) − money(total_for_services) − money(tax)` |
| `total` | `money(total_including_tax)` |
| `created_by_employee_id` | null |

`fee` is the remainder that makes `total` equal ArboStar's `total_including_tax` exactly —
total fidelity is the one non-negotiable. In this tenant's export the fee is 0 everywhere
except invoice 00115-I (93.14). A negative remainder is kept, not rejected, and counted in
the import report.

`taxable_subtotal` is NOT NULL and the export does not carry it. The derivation is tiered,
with the company's imported `tax_rate` rows as the candidate rates:

1. Untaxed invoices store 0.
2. When a candidate rate satisfies `round(rate × total_for_services) = tax`, the whole
	invoice is taxable and `taxable_subtotal` = `subtotal`. That rate is also the
	invoice's `tax_rate`. In this tenant's export: 272 of the 278 taxed invoices.
3. When the lines reconcile and a candidate rate reproduces `tax` from the taxable lines
	minus the discount, sum the taxable lines' totals. Here: 5 invoices.
4. Otherwise derive `round(tax / rate) + discount` with the best-matching candidate rate,
	and count the invoice in the import report. The derived base can be off by a few cents
	because the stored tax was rounded. `tax_total` and `total` still come from the
	header, so drift here is cosmetic. Here: 1 invoice (00529-I, no line rows), where the
	division happens to be exact.

`invoice_number` = lead number × 10 + the suffix, where a suffix-less `NNNNN-I` takes 0
(`02019-I-1` → 20191, `01434-I` → 14340). The 0 default matters: six leads carry both
`NNNNN-I` and `NNNNN-I-1`, so defaulting to 1 would collide. All 906 numbers parse under
this rule and none collide. The largest is 21581. After inserting, set
`invoice_number.next_number` to the next power of 10 above the largest constructed number
(100,000 for this tenant), through the same `GREATEST(next_number, ?)` guard
`import_projects.ts` uses for project numbers. Other tenants' `invoice_no` formats are
unverified — assert that every number parses and that no constructed numbers collide.

### invoice_line_item rows

From `line_items.js` rows that carry an `invoice_id` (1,446 rows across 843 invoices).

| column | source |
| --- | --- |
| `project_line_item_id` | the `arbostar_line_item_id` correlation from `import_line_items` |
| `description` | `service_name` |
| `quantity` / `price` | `money(quantity)` / `money(price)` |
| `discount_rate` / `discount` | null |
| `taxable` | `!non_taxable` |
| `sort` | `sort_order` |

These lines do not sum to `subtotal` on roughly 130 invoices (no rows, zero-amount rows,
or partial rows). Per the decided list: import them as they are and never recalculate the
header totals from them. The stored-total invariants only hold for app-created invoices.

### import_line_items.ts changes

`project_line_item.sort` is new and NOT NULL — write `sort_order` into it.

### import_payments.ts changes

- `amount` becomes `money(payment_amount) − money(payment_tips)`. Today the import writes
	the tip-inclusive `payment_amount`. Re-import corrects existing rows through the normal
	bulk_update path. The company-wide payment total drops from 943,192.53 to 937,258.12.
- New columns: `payment_tips` → `tip`, `payment_fee` → `merchant_fee`, `payment_notes` →
	`notes`.
- `payment_author` → `recorded_by_employee_id` through `employee_id_by_arbostar_user_id`.
	0 and null map to null. Plumbing prerequisite: `import_arbostar_export.ts` passes only
	`employee_id_by_name` into the post-employee context — also pass the current run's
	`employee_id_by_arbostar_user_id`.
- Allocations with an `invoice_id` become `payment_invoice` rows, one per
	(payment, invoice) pair. Sum amounts with fnum — the current code sums allocation
	floats with a raw reduce, and that pattern must not carry over. Skip the 2 allocations
	whose invoice is missing from the export, with a count.
- Estimate-only allocations resolve estimate → lead → project into `payment.project_id`,
	replacing the payment_project rows. The one mixed payment gets both `payment_invoice`
	rows and a `project_id`.
- `payment_invoice` reconciliation mirrors the old payment_project logic: only touch rows
	whose payment is import-correlated, diff by pair, update amounts, delete removed pairs.
- Delete the payment_project reconciliation code. The migration drops the table.
- Existing multi-tenant gap, same spirit as the no-hardcoding rule:
	`ARBOSTAR_TENANT_TIME_ZONE` is a hardcoded `'America/Chicago'` constant in
	`import_payments.ts`. It must become per-tenant input before other tenants import.

### import_projects.ts changes

`project.subtotal` currently maps from `total_for_services`, which is net of discount.
Under the new model `subtotal` is pre-discount. Change the mapping: `subtotal` = the sum
of `money(total_for_services) + money(discount)` per invoice, `discount` = the summed
`money(discount)` (null when zero), `total` unchanged. Set `taxable_subtotal` by the same
derivation the invoice importer uses — the project column is nullable, so null is fine
when it cannot be derived.

## Implementation details and concerns

Researched 2026-08-13. File references point at current code.

### Migrations

- The next migration number is 0038 (`src/migration/`, plain SQL, multi-statement files,
	no rollbacks). Suggested split: 0038 the new invoice tables plus
	`company.invoice_due_after_days` plus seeding `invoice_number` rows for existing
	companies, 0039 the project/project_line_item discount and sort columns, 0040 the
	payment columns plus dropping `payment_project`.
- The `sort` backfill follows the established pattern (0016, 0022): add the column
	nullable, backfill with `ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY
	project_line_item_id)`, then `MODIFY … NOT NULL`.
- `pnpm run local:db_up` applies the migrations and regenerates the schema exports.
- `create_company.ts` gets an `invoice_number` seed next to its `project_number` seed.

### Types and validators

- `scripts/export_schema.ts` writes `schema/type/<table>.d.ts` boilerplate only when the
	file is absent, then never touches it again. Write the new override files
	(`invoice.d.ts`, `invoice_line_item.d.ts`) with the discriminated unions from the
	schema sections. The `project.d.ts` and `project_line_item.d.ts` overrides already
	exist — hand-edit them to add the discount unions next to the existing tax and done
	unions.
- Every new table needs a hand-written validator in `schema/validator/` plus registration
	in `schema/validators.ts`. A type check enforces that the registry is complete. Mirror
	the unions there (`jv.one_of`, like `with_tax_consistency` in
	`schema/validator/project.ts`). Caution from existing code: `schema/validator/project.ts`
	passes an explicit generic to `with_tax_consistency`, which hides missing-column errors
	from the `satisfies` check (it is missing five newer columns today). Let the generics
	infer in new validators.
- Dropping `payment_project` makes export_schema delete its type files. Delete its
	validator and registry entry by hand.

### Calculation code

- Implement `invoice_calculation.md` as pure functions over FinancialNumber in
	`src/shared/invoice/`. Only the `src/shared/**` and `scripts/**` test globs run under
	`node --test`, so shared placement is what makes the math testable. There is no test
	database — endpoints only get type checks.
- `fnum.ts` has `greatest_of` but no `least_of`. Add it — the formulas use `least()`.
- FinancialNumber has no division. The proportional project-discount spread (share =
	project discount × invoice subtotal ÷ project subtotal) needs bigint cent math:
	multiply the cent values, integer-divide, and let the final resolving invoice take the
	remainder. The model already assigns the final invoice the remainder, so truncation is
	safe.

### Query and write concerns

- typed_query_builder supports only COUNT, COUNT DISTINCT, IS [NOT] NULL, and UUID_TO_BIN
	as functions — no SUM. The credit pool, billed balances, and amount-paid queries need
	one of: SUM added to the builder, raw `mysql.query({ sql, values })`, or a JS fold over
	selected rows. Recommendation: add SUM to the builder once, since at least three flows
	need it.
- `write_helper.update` writes `WHERE <key> = ?` with no company guard. That matches
	existing usage. Multi-column guards need raw SQL (see `client.fns.ts:65`).
- Invoice immutability is app-code discipline only. Nothing at the DB layer prevents
	updates. Per the decided list, the importer overwrites the rows it imported, and
	app-created invoices are never touched.
- `payment.amount` is DECIMAL(12,2) (pre-existing), and `payment_invoice.amount` matches
	it. The new `tip` / `merchant_fee` columns are DECIMAL(10,2), plenty for their ranges.
	The width mismatch is deliberate.

### Deferred to the app/UI phase (not planned here)

- The invoice-creation server function. It follows the `create_lead` pattern: one
	transaction, `LAST_INSERT_ID` number allocation (`lead.fns.ts:68`), snapshot query,
	typed insert.
- The project close flow. No close endpoint exists today — `closed` is written only by
	lead creation (as false) and by the import.
- Request-time permission checks. `CAN_EDIT_PAYMENTS` is seeded but nothing reads
	permissions at request time.
- Client-side money formatting. `project.total` renders raw today, and no currency helper
	exists.

## Questions to resolve before implementation

None. All six questions from the 2026-08-13 research are resolved into the decided list
and the import section.
