// Disabled export. It wrote arbostar_export/crew_roles.js + arbostar_export/work_types.js
// from the estimate editor payload (/estimates/edit/{lead_id}), the only known source of the
// two labor catalogs:
//
// - `crews` — what the UI calls Crew Roles (CL3, GM, ...) with cost per hour. Line items
//   reference these by code in their `crews` string (line_items.js).
// - `work_types` — the pruning work types (ip_*: Clean canopy, Crown reduction, ...).
//   These attach to tree inventory entries, not to line items.
//
// The estimate editor writes on load, so it must never be fetched (see "Editor pages write
// on load" in readme.md). export_all.ts skips this script and the files on disk stay as
// they are. Re-enable it once the catalogs have a read-only source.

throw new Error(
	'export_work_types.ts is disabled: the crew roles and work types catalogs came from the estimate editor, which writes on load. It needs a read-only source before it runs again. See "Editor pages write on load" in scripts/arbostar/readme.md.',
)
