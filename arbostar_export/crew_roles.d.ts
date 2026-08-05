// Shape of one element in arbostar_export/crew_roles.js (see export_work_types.ts).
// One row per crew role — what the app's UI calls "Crew Roles" (managed at
// /employees/crews; the API calls them `crews`, hence the field prefix). Line items
// reference these by code: `ArbostarLineItem.crews` is a comma-joined list of
// `crew_name` values (e.g. 'CL3, GM').
// Values observed in the August 2026 export; the account can add more.
export type ArbostarCrewRole = {
	crew_id: number
	/** Short code, e.g. 'CL3', 'GM' — the UI's "Crew Name" column, and what line_items.js `crews` strings contain. */
	crew_name: string
	/** The UI's "Crew Role" column, e.g. 'Arborist Climber'. Not unique — CL0-CL3 share one. */
	crew_full_name: string
	/** The UI's "Cost Per Hour" column, in dollars. */
	crew_rate: number
	/** 1 = active. */
	crew_status: number
	/** Hex color used in the schedule UI. */
	crew_color: string
	/** Display sort order in the app. */
	crew_priority: number
}

// crew_roles.js is an ESM module whose default export is the full array of records.
declare const crewRoles: ArbostarCrewRole[]
export default crewRoles
