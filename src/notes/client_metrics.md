"Proposals" – a count of all client projcts that at any point had a project_document with needs_client_approval_to_move_on.

"Accepted" – a count of all client projects that currently have a project_document with represents_billable_sale_when_closed.

Latest jobs total: the sum of the project totals for projects with a closed_date in the last year, that are closed and have a project_document with represents_billable_sale_when_closed.

Latest job count: the number of projects considered in the number above.

## Deprecated

Too difficult to query for "most recent 3 projects" for multiple clients:

```
Latest jobs total: the sum of the project totals for the most recent (by closed date) projects, max 3, that are closed and have a project_document with represents_billable_sale_when_closed.

Latest job count: the number of projects considered in the number above (0-3).
```
