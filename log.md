## 2026-06-02

- Got logging in/querying working in the worker.  Implemented int -> bigint and datetime/date -> temporal casts from mysql.
- Got the client actually working and loading a page.

## 2026-05-27

Added AND/OR support to the group_by, select, where, and join on clauses.  They need to have aliases in the selects, but not anywhere else.
