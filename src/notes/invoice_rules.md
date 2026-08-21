# Invoice rules

Enforced in app code, not by the schema. Calculation formulas live in `invoice_calculation.md` and `client_balance_calculation.md`. The close flow lives in `project_close.md`.

- Invoices are immutable and permanent from the moment they are created. There is no draft, open, or void state, no editing, and no hard delete. The only "open" thing about an invoice is its unpaid balance.
- A refund or the cancellation of an incorrect invoice is represented as an invoice with negative lines
- A refunding invoice does not return the client credit the original consumed (negative-subtotal invoices apply no credit, and applied amounts are immutable). The cancel flow must re-grant that amount as a new `client_credit` row.
- Invoice line items link to project line items optionally and carry their own amounts. That allows partial billing of a line, several project lines on one invoice, one project line across several invoices, and fee lines that link to no project line.
- `due_date` prefills as `invoice_date + company.invoice_due_after_days`. The author can override it per invoice.
