Fix Claude output:
- on typed_query_builder, you should be able to add functions to selects in addition to inside comparisons
- row output type is wrong in validate_session, check the TODO

that filter on line 199 of typed_query_builder is unnacceptable.  All rows in the response must be represented in the array.  Make sure some of the existing tests test
  this behavior.


It's time to make the typed query builder able to take functions in the select.


1. The expression_builder functions (comparison, and, fn) need to be accessible at all points during query-building (or at least, in the select), not just the join+where
2. The select array needs to not allow FunctionExpression, but instead hold SelectableFunctionExpression, which is FunctionExpression & { table_identifier, alias }
3. The return type of expression_builder.fn needs to include the table_identifier and alias.  They don't need to exist/be valid when used in e.g. comparators, but they do need to exist (don't need to be type-checked against anything) when passed in via the select.
  - should the fn arguments be named rather than positional?  Maybe/probably?
4. Are those __underscored variables in the types really necessary?



## higher level

- form that creates a company+initial employee with password, using the create_company endpoint
- function that creates a session in the database and sets a cookie
	- new table
		- session uuid
		- sign in user agent
		- sign in datetime
		- last seen datetime
		- last seen user agent
		- expiration datetime
		- invalidated boolean
- prettify?  meh
- bare login endpoint that sets a cookie
- server-side handling of `fn` endpoint: check the cookie, look up the user, look for the function, validate the argument
- login screen in ASR
- the script that builds the server_functions types for the client needs to also output a module that implements a function for each of those functions, that falls back to a fetch-backed function that calls the server-side `fn` endpoint
- query function that runs safe sql queries
	- function to iterate over query data structure and add `AND company_id = ?` clauses
	- blacklist some tables from safe queries: employee_session
		- eventually consider making safe queries whitelist-only rather than blacklist
- start building ui
