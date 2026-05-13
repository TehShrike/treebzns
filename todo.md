## higher level

- client with ASR+context
- a few actual endpoints e.g. login
- most hacky bullshit auth ever
	- bare login endpoint that sets a cookie
- ability to call "server functions" via api
- server-side handling of `fn` endpoint: check the cookie, look up the user, look for the function, validate the argument
- query function that runs safe sql queries
	- function to iterate over query data structure and add `AND company_id = ?` clauses
- start building ui
