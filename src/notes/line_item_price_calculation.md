# Line item price estimate calculation

See: `shared/estimate/line_item_price.ts`

The estimate screen fills in a line item's price from four inputs.  The math lives in `#shared/estimate/line_item_price.ts`.

- Estimated crew: the number of people the estimator imagined working on this item.
- Estimated hours: the number of hours the estimator thinks it will take to finish the item.  This can only be interpreted in light of the number of crew that the estimator was imagining.
- Rate: the hourly rate used to estimate the price.  Currently defaults to the average of the hourly rates of the selected work skills.
- Rounding increment: How to round the resulting estimated price.  `company.round_line_item_estimates_to_nearest`

Estimated price = (hours × crew × rate) rounded to nearest rounding increment
