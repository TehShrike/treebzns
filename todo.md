Review the import_arbostar_export scripts.

- Make a module that takes an ASR instance and returns a store/reactive that exposes the current state and the state being transitioned to
	- May as well also expose "are we transitioning to another state" as a boolean
	- When at app.projects.*, if we are transitioning to another state, and that target state is also app.projects.*, we should hide the ui-slot and display "loading" in the app.projects state
- Input focus border needs to look the same everywhere (embrace the rounding I guess)

# "Create A Lead" interface

- identify everything that needs to be an input when creating a lead - look at the schema
- basic text input

# Deploying

- Finish deploy
	- Add mysql user to prod database for CFW
	- add mysql environment variables to CFW
	- Wrangler deploy CFW from master

# Export/import

- Chrome extension
- Make `fetch` calls with cookies
- https://claude.ai/chat/a7d94343-6ef6-4cb4-9062-2b4796cf1e36
- some endpoint that clients and leads can be uploaded to

# some time

- auto-prettify
- Redirect to app after creating company
- livereload in browser
- safer migration deploys
	- set a variable when deploying
	- have a worker check that variable and pause prod api requests
	- run migration while paused
