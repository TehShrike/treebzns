
## Server functions

If a row being updated or inserted contains a foreign key id, then it will not be automatically checked by the TenantedWriteHelper, and we need to validate that the foreign key ids correspond to records that belong to the same company.  `SELECT COUNT(*) AS matching_id_count FROM foreign_table WHERE foreign_table_id IN(<array of ids>)`, followed by an assertion that matching_id_count is the same as the length of the array is a good pattern, the TransactionTenantedSelectBuilder will ensure the company id.

assert_db_id_valid.ts can be used to assert this validity.

The server does not validate anything about the foreign keys except that their records belong to the same company.  The client is responsible for validating everything else.
