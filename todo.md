- "Create A Lead" interface
	- server-side handling of `fn` endpoint: check the cookie, look up the user, look for the function, validate the argument
	- the script that builds the server_functions types for the client needs to also output a module that implements a function for each of those functions, that falls back to a fetch-backed function that calls the server-side `fn` endpoint
- query function that runs safe sql queries

# some time

- auto-prettify
- Redirect to app after creating company
