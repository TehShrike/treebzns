
## Server functions

### Inserting and updating records

Server functions for inserting, updating, upserting records should be generic, and usable from multiple interfaces.

The argument types for server functions should be defined by the database schema, which does not change across user interfaces.

User interfaces do not usually require bespoke server functions.  If a user interface seems to require an unusual addition to an existing server function, that points to a design decision to be brought up to the developer before implementing.

### Validating ids sent from the client

If a row being updated or inserted contains a foreign key id, then it will not be automatically checked by the TenantedWriteHelper, and we need to validate that the foreign key ids correspond to records that belong to the same company.  `SELECT COUNT(*) AS matching_id_count FROM foreign_table WHERE foreign_table_id IN(<array of ids>)`, followed by an assertion that matching_id_count is the same as the length of the array is a good pattern, the TransactionTenantedSelectBuilder will ensure the company id.

assert_db_id_valid.ts can be used to assert this validity.

The server does not validate anything about the foreign keys except that their records belong to the same company.  The client is responsible for validating everything else.

An id used only in the WHERE clause of a tenanted update or delete needs no check – silent failures when inserting or updating are fine.  We only need to prevent writing ids that point to another company's records.

Ids that point to non-tenanted tables do not need to be validated.
