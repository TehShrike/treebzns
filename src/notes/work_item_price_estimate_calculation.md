# Work item price estimate calculation

See: `shared/estimate/line_item_price.ts`

The estimate screen fills in a work item's price from five inputs.

- Estimated crew: the number of people the estimator imagined working on this item.
- Estimated hours: the number of hours the estimator thinks it will take to finish the item.  This can only be interpreted in light of the number of crew that the estimator was imagining.
- Work type hourly rate
- Equipment

Hourly rate: (crew × work type hourly rate) + (sum of all equipment hourly rates)

Estimated price = (hours × hourly rate) rounded to nearest 0.01.
