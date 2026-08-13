# Invoice calculation

*Note: round() means round to 2 digits after the decimal place*

Fees are after taxes.

Discounts are before taxes.

## Line item

```
line_item_gross = quantity * price
actual_line_item_discount = if discount_rate is set, round(discount_rate * line_item_gross), else if discount is set, line_item_gross - discount,
else 0

line_item_total = (quantity * (price - actual_line_item_discount))
```

## Invoice

*Enforced in code: if invoice.discount is set, line items will not have their own discounts*

```
invoice_level_discount = if discount is set, discount, else 0

subtotal = (sum of all line_item_total) - invoice_level_discount
taxable_subtotal = (sum of all line_item_total where the line item is taxable) - invoice_level_discount
line_item_discount_subtotal = sum of all actual_line_item_discount

tax_total = round(tax_rate * taxable_subtotal)
total = subtotal + tax_total - fee
```
