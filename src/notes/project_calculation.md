Project estimate calculation uses `project` and `project_line_item` and follows the same rules as [invoice calculation](./invoice_calculation.md) where applicable, with these notable differences:

- Project line items have no quantity to multiply by the price
- Lines with `client_declined` are ignored
- Project line items may have either discount rate on `project_line_item.discount_rate`, or their work items may have flat discounts on `project_line_item_work_item.discount` that are summed to find the total project line discount

If and when we add "client_optional_declined_by_default", we will probably want to ignore those as well.
