# Client balance calculation

Only invoices and payments affect the client balance.

A positive balance means the client owes money.

`payment.amount` excludes tips. `tip` and `merchant_fee` never enter any balance math.

Allocations (`payment_invoice`) never enter the client balance. They only indicate which individual invoices still show a balance when you look at them.

## Client balance

```
client_balance = sum(invoice.total) - sum(payment.amount)
```

## Per-invoice

```
invoice_amount_paid = sum(payment_invoice.amount) where payment_invoice.invoice_id = the invoice
invoice_balance = invoice.total - invoice_amount_paid
```

## Per-payment

```
unapplied_credit = payment.amount - sum(payment_invoice.amount) for the payment
```

When the payment has a `project_id`, its unapplied credit is understood to be waiting for that project's invoices.

## Client credit

Client credit is not a balance item. Granting credit changes no invoice and no balance. It only reduces the payment required for future invoices, pre-tax (see `invoice_calculation.md`).

```
available_client_credit = sum(client_credit.amount) - sum(invoice.client_credit_applied)
```
