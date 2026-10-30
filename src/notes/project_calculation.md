Project estimate calculation uses `project` and `project_line_item` and follows the same rules as [invoice calculation](./invoice_calculation.md) where applicable, with these notable differences:

- Lines with `client_declined` are ignored

If and when we add "client_optional_declined_by_default", we will probably want to ignore those as well.
