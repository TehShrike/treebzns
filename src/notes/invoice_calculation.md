# Invoice calculation

*Note: round() means round to 2 digits after the decimal place*

Fees are after taxes.

Discounts are pre-tax.

Tax rate will be < 1.

Line item discount will be <= line item gross.

Client credit is not a discount, but it is functionally similar to a discount given in advance, and will be applied pre-tax.  Client credit does not affect the client's balance.

## Line item

```
line_item_gross = round(quantity * price)
actual_line_item_discount = if discount_rate is set, round(discount_rate * line_item_gross), else if discount is set, discount,
else 0

line_item_total = line_item_gross - actual_line_item_discount
```

## Invoice

*Enforced in code: if invoice.discount is set, line items will not have their own discounts*

*Enforced in code: if invoice.subtotal is negative, invoice-level discounts are not allowed*

```
available_client_credit = sum(client_credit.amount) - sum(invoice.client_credit_applied)

subtotal = sum of all line_item_total
taxable_subtotal = sum of all line_item_total where the line item is taxable

line_item_discount_subtotal = sum of all actual_line_item_discount

invoice_level_discount = if discount is set, least(discount, subtotal), else 0
client_credit_applied = if subtotal < 0, 0, else least(subtotal - invoice_level_discount, available_client_credit)

total_price_reduction = invoice_level_discount + client_credit_applied

taxable_amount = if taxable_subtotal > 0, greatest(taxable_subtotal - total_price_reduction, 0), else taxable_subtotal

tax_total = if taxable, round(tax_rate * taxable_amount), else 0
total = subtotal - total_price_reduction + tax_total + fee
```
