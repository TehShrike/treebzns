# Safely read the data the export lost when the estimate editor was banned

On 2026-09-12 the export fetched ArboStar's estimate editor, `GET /estimates/edit/{lead_id}`,
for every lead without an estimate. Loading that page creates a draft estimate and moves the
lead to status Draft. It moved 198 production leads (the lists are in
`accidental-new-draft-leads.txt` and `accidental-no-go-draft-leads.txt` at the repo root,
both untracked). Phase 1 removed every editor fetch from the export scripts. This note is the
plan for phase 2: get the same data back from read-only endpoints. The rule itself is in
`scripts/arbostar/readme.md` under "Editor pages write on load".

Every step below needs a fresh session in `scripts/arbostar/.arbostar_session.json` and must
follow the safety protocol first. Nothing here may be scripted into `export_all.ts` until its
endpoint has passed the protocol.

## Safety protocol for any new per-record endpoint

Run it by hand, one lead at a time, before any script uses the endpoint.

1. Pick one lead that has no estimate and is in status No Go. Its row in the `/leads`
	 datatable is the baseline: record `lead_status_id`, `lead_status_name`, and
	 `lead_reason_status_id`. Use `fetch_all_rows_every_status` from
	 `scripts/arbostar/fetch_datatable.ts` with `path: '/leads'`, or the datatable request the
	 export already makes. The datatable is the only known read that is safe for a lead without
	 an estimate (the estimate profile answers 500 for it).
2. Fetch the candidate endpoint once for that lead, with `accept: application/json` and the
	 `x-requested-with: XMLHttpRequest` header, as `fetch_json` does.
3. Re-read the lead's datatable row. Status id, status name, and reason id must be unchanged.
4. Open the lead's profile page in the browser (`/{lead_no}-L`) and confirm the Estimates
	 panel still shows no estimate.
5. Repeat steps 1 to 4 with one New lead (they are the ones the office is still working).
6. Only then wire the endpoint into a script, and run that script once with a small
	 hard-coded lead list before running it for everything.

A page or endpoint whose URL contains `/edit/`, `/create`, `/add`, `/new`, `/save`, `/update`,
`/delete`, or `/change` fails the protocol on sight. Do not test it.

## 1. Lead description and lead source detail for leads without an estimate

**Lost:** `lead_body` (the Lead Description box, imported as `project.lead_details`) and
`lead_source_details` (the free text behind an "Other" source, imported as the lead source
name) for every lead with no estimate. About 200 leads at any time, including the New leads
the Leads To Estimate screen exists to show.

**Candidate endpoint:** `GET /leads/leads/profileData/{lead_id}`. It is listed in
`/assets/js/config/routes.js` as the data source of the lead profile page `/{lead_no}-L`.
The office views that page for leads without an estimate all day without creating one, which
is the reason to expect it to be safe. It has never been fetched by a script. Its shape is
unknown.

**Verification, after the safety protocol:**

- Confirm the response carries a `lead` object with `lead_body` and `lead_source_details`,
	and note whether `lead.estimate` is present for estimated leads (it may be, making this
	endpoint a second source for the estimate notes too).
- Check that `lead_body` matches the Lead Description shown on the profile page for the same
	lead.
- Measure payload size and request rate the way the profile endpoint was measured (see the
	line-items section of the readme), since this pass adds one request per unestimated lead.

**Code changes:**

- `scripts/arbostar/lead_notes.ts`: add back a `fetch_notes_for_leads_without_estimates`
	that calls the lead profile endpoint. Reuse `to_lead_notes` if the `lead` object has the
	same field names, or add a second mapper if it does not. Keep the concurrency low (2) like
	before until the rate is measured.
- `scripts/arbostar/export_line_items.ts`: read leads.js again, compute the unestimated lead
	ids, and run the new fetch in parallel with the profile pass, as the removed code did. The
	merged `lead_notes` list goes into `lead_notes.js` unchanged.
- Update `arbostar_export/lead_notes.d.ts` and the readme's lead-notes paragraph to name the
	new source.
- No import change: `import_projects.ts` already reads both fields from `notes_by_lead_id`
	and treats a missing row as empty.

## 2. Crew roles and work types catalogs

**Lost:** the source for `crew_roles.js` and `work_types.js`. `export_work_types.ts` is
disabled and `export_all.ts` skips it, so the files from 2026-09-12 stay on disk. The import
still reads `crew_roles.js` into `work_skill`, and the line-item importer asserts every crew
code on a line item exists there. A new crew role added in ArboStar will make that assert
fail at import time, which is the signal that this step is overdue. `work_types.js` has no
consumer.

**Candidate endpoints:**

- Crew roles are managed on the page `/employees/crews` (see the readme's labor-catalogs
	section). It is a list page, so it is most likely a DataTables endpoint like `/clients` or
	`/leads`: try `GET /employees/crews` with the datatable headers and the standard paging
	params through `fetch_all_rows` from `fetch_datatable.ts`. If it is server-rendered HTML
	instead, scrape it the way `export_taxes.ts` scrapes `/settings`.
- Work types (`ip_*`) have no known page. The tree inventory `show` endpoint
	(`POST /treeInventory/show/{tis_id}`, already used by `export_tree_inventory.ts`) attaches
	`work_types[]` to trees and may carry the catalog. If nothing turns up, drop the file: no
	code reads it.

**Verification:** the crew rows must carry `crew_id`, `crew_name` (the code such as `CL3`),
`crew_full_name`, `crew_rate`, `crew_status`, `crew_color`, and `crew_priority`, the fields in
`arbostar_export/crew_roles.d.ts`. Compare the result against the existing `crew_roles.js`
before replacing it. The catalog endpoint is a list read, not a per-lead read, so the safety
protocol's lead checks do not apply, but the URL rule does.

**Code changes:** rewrite `export_work_types.ts` around the new source, keeping the output
shapes, and put it back into `export_all.ts` (it no longer depends on estimates.js, so it can
join the independent list).

## 3. Line items inside service groups

**Lost:** the child line items of estimates that use a service group (a named package such as
"Tree Removal Plus" on estimate 01422-E, lead 1422). The estimate profile lists the group
under `estimate_groups` with an empty `children` array and leaves the children out of
`estimates_service`. 12 estimates had groups on 2026-09-12; the export now prints their lead
ids at the end of the line-items pass. The group itself was never exported, only its
children flattened as ordinary line items, so the only loss is those child rows.

**Candidate endpoints:** a page that renders the estimate for reading. Candidates, all to be
checked against the URL rule and then the safety protocol (these leads have estimates, so
also confirm the estimate's `status_id` and `last_update` on `/estimates` are unchanged):

- The estimate profile page `/{lead_no}-E` itself. `profileData` is its JSON, but the page
	may load a second request for the items table. Capture its XHRs with
	`discover_details.ts` (edit URLs are removed from its targets) pointed at one grouped
	estimate, or watch the Network panel by hand.
- `/estimates/view/{estimate_id}`, already in the crawler's target list.
- The client-facing proposal or PDF render, if the profile page links to one. It must show
	the package contents to the client, so the children are in it somewhere, possibly only as
	HTML.

**Verification:** for lead 1422 the children are line items 2485, 2486, and 2487 (Tree
Removal 3680, Stump Grinding 340, Topsoil and Grass Seed 220, summing to the group total
4240). Any source must return those three ids with the same fields the profile returns for
standalone items, or the mapper needs a second shape.

**Code changes:** restore a fallback in `export_line_items.ts` for leads whose profile shows
`estimate_groups`, taking children from the verified source. Keep the unique-id assert. If
the source is HTML, put the scraper in its own module the way `lead_notes.ts` holds the
notes mapper.
