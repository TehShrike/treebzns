# Project close

Applies to projects whose document `represents_billable_sale_when_closed`. Closing one creates an invoice. No close endpoint exists yet — `closed` is written only by lead creation (as false) and by the import.

## Validation

Closing requires:

- Every non-declined line item is done (`done_at` set).
- Every non-declined line item's billed balance ends at zero: its linked invoice lines' net amounts equal the project line's net amount (gross minus its discount).
	- see invoice_calculation.md for line item total

## The final resolving invoice

The close flow creates a final invoice for every line's remaining balance.

A project-level discount spreads across the project's invoices: each partial invoice takes a roughly proportional share of the project subtotal.  The proportion is calculated based on the line item subtotals of the invoiced line items compared to the project subtotal.  The final invoice takes whatever discount remains, so rounding can never strand or double a cent.

If the final invoice's balance is negative, some project-level discount may be lost, which is reasonable.

## Applying payments

After creating the final invoice, apply the client's payments that carry the project's `project_id` and still have unapplied credit, up to the invoice total, by inserting `payment_invoice` rows. The payment rows themselves never change. See `invoice_and_payment_rules.md` and `client_balance_calculation.md`.
