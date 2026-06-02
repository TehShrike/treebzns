- Move the login form to the login page
- Add an app page that is the post-login landing page
- "Log in" link from index.html to app.html
- Redirect to app after creating company?
- What is the first thing to do on the app screen?
	- Create A Lead interface
	- See higher level needs below: need to get server_functions working

## higher level

- prettify?  meh
- server-side handling of `fn` endpoint: check the cookie, look up the user, look for the function, validate the argument
- the script that builds the server_functions types for the client needs to also output a module that implements a function for each of those functions, that falls back to a fetch-backed function that calls the server-side `fn` endpoint
- query function that runs safe sql queries
	- function to iterate over query data structure and add `AND company_id = ?` clauses
	- blacklist some tables from safe queries: employee_session
		- eventually consider making safe queries whitelist-only rather than blacklist
- start building ui
