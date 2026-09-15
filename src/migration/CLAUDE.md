## company_id in indexes

Every tenant-scoped table has a company_id column.  Every query filters on it for permission scoping.  That does not mean indexes need it.

Do not put company_id in front of a globally-unique id column (any *_id that is an AUTO_INCREMENT primary key in its own table).  All rows that match one id value already belong to one company.  The prefix filters nothing and only makes the index larger.  Index the id alone.  The `WHERE company_id = ?` clause still runs as a cheap check on the fetched rows.

Lead with company_id only when the next column's values are shared across companies:

- User-entered values in unique keys: names, titles, emails (e.g. `uq_line_item_template_company_title`).
- Dates and flags (e.g. `idx_time_entry_company_work_date`, `idx_project_company_closed`).
- Global codebook ids.  `project_document` and `permission` have no company_id, so their ids repeat across companies (e.g. `idx_project_company_document`).
- NULL.  NULL values span companies.  A nullable column queried with `IS NULL` per company needs the prefix (e.g. `idx_project_company_estimator` for "unassigned projects").

A bare `(company_id)` index is only for "load all rows for the company" on catalog tables.  It is redundant when the table has a `(company_id, ...)` unique key.  Also skip an index when an existing unique key starts with the same columns.
