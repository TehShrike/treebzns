- export types and metadata from schema
- tool to build select queries in a type-safe way
	- generate a format that is safe to accept from untrusted sources
		- identifiers that can be verified against the schema
		- whitelist of clauses
		- whitelist of functions
		- parameterized/escaped values
	- "things" in the query can be
		- clause (identifiers, whitelisted comparator)
		- table identifier (initially table name + alias, then just the alias for future references)
		- column identifier (table alias + column name, can include an alias in the select)
			- in group by/having, column alias
			- in join/where, table alias + column name
			- throw an error if multiple columns with same alias
		- user-provided value (to be parameterized)
		- mysql function (whitelisted name, plus any column identifiers or user-provided values as arguments)
	- query data structure needs to be easily iterated over so that `AND company_id = ?` clauses can be added later
- a directory full of modules that export functions that can be "called" from the client
	- generate the types of all the functions and export them somewhere accessible by the client
		- functions take a single argument
		- argument defined/validated by json validator
		- optional permissions function that takes the user and a permissions object and returns true/false
	- client-side, generate a function for each of those server-side functions, that can be called with the signature of the server-side function, that makes a query to a `function` endpoint with everything relevant as the body
	- server-side `function` endpoint that uses the validator to validate the argument, then calls the underlying function and returns the value
- a select_query endpoint that takes the shape of a safe query, and iterates over it adding `AND company_id = ?` to every relevant clause

## export types and metadata from schema

Data used to validate queries are reasonable server-side.

Identifiers in the data can be referenced directly when building queries.

The type of the data can be used to type-check queries as they are written.

```ts

```
