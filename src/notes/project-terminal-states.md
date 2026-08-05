Two kinds of expiration:
- stops showing up in searching
- doesn't go straight to approved any more if they approve it

- "Stops showing up in searches" expiration: default 3 month
- ✅ (migration 0031, 2026-08-03) New project document: "Declined Proposal"
	- ✅ closed by default (add as new boolean on project_document)
	- ✅ new "declined_project_document_id" column – "Propsal/Estimate" statuses have that id set to whatever "Declined Proposal" id is (also set on all three work-order documents → Cancelled Work Order)
	- ⏳ deferred to the in-app decline UI round: new boolean column "ask for decline reason"
	- ⏳ deferred to the in-app decline UI round: add "decline_reason" text column to project table
	- ✅ add "project_decline_reason" table (per-company; seeded with the six reasons below on migration and on company creation)
		- Price too high
		- Went with a lower bid
		- Weren't pleased
		- Didn't like credentials
- ✅ Call it "Proposal" by default instead of "Estimate"
- Make sure "accept" flow from Proposal -> Work Order is modeled
- ✅ Have a "Work Order (Cancelled)" (named "Cancelled Work Order"; sort right after Declined Proposal, Void last)
	- What you get when you "decline" a work order project document
	- ✅ Closed by default
	- Declined reason probably – maybe slightly different list? (the seeded per-company list currently covers both stages — splitting per-document would need a schema change)
		- ✅ Scheduling troubles (seeded)
		- ✅ Financial troubles (seeded)

## Prompt

k, time to make some changes to project_documents:

- Add new "declined" boolean to project_documents, false for all existing rows
- Add new "closed_by_default" boolean to project documents, false for all existing rows except "Void"
- Rename "Estimate" to "Proposal"
- Add "Cancelled Work Order"
	- all options set to false except `declined` and `closed_by_default`
	- towards the end of the sort order, with "Void" the only thing after it
- Add "Declined Proposal"
	- all options set to false except `declined` and `closed_by_default`
	- right before "Cancelled Work Order" in the sort order

New table:
- `project_decline_reason`
	- project_decline_reason_id
	- company_id
	- reason non-nullable varchar 200
- Migration should add these reasons for each current company, and these should also be inserted when a new company is created:
	- Price too high
	- Went with a lower bid
	- Weren't pleased
	- Didn't like credentials
	- Scheduling troubles
	- Financial troubles

Project should get new nullable column "project_decline_reason_id".

These changes should enable us to represent some data from arbostar that we couldn't before.  It might be useful to refer to arbostar_client_state_differences.md.

Make a plan for all the steps that should be done and write it to 2026-08-03-project-status-work-plan.md.  Ask me any questions about details I might have missed or any ambiguities that ought to be resolved before starting work, and represent those in the plan file.

If there is any data not currently being pulled from arbostar around statuses that we ought to be exporting, feel free to browse around (GETs only, no writes) looking for it.


## Next

Implement "expired", except phrase it as "hide after N days" on both project_document and "hide after date" on project.
