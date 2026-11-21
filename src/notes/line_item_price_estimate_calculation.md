# Line item price estimate calculation

See: `shared/estimate/line_item_price.ts`

The estimate screen fills in a work item's price from five inputs.

- Estimated crew: the number of people the estimator imagined working on this item.
- Estimated hours: the number of hours the estimator thinks it will take to finish the item.  This can only be interpreted in light of the number of crew that the estimator was imagining.
- Work type hourly rate
- Equipment
- Rounding increment: How to round the resulting estimated price.  `company.round_line_item_estimates_to_nearest`

Hourly rate: (crew × work type hourly rate) + (sum of all equipment hourly rates)

Estimated price = (hours × hourly rate) rounded to nearest rounding increment.
