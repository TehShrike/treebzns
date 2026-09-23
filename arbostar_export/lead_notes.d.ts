// Shape of one element in arbostar_export/lead_notes.js (see export_line_items.ts + lead_notes.ts).
// The free text ArboStar keeps only on the full lead entity, one row per estimated lead.
// `lead_id` links to leads.js. Leads without an estimate are absent (their only known
// source is the estimate editor, which must not be fetched). Every field is a string: null
// and missing values export as '', CRLF line endings become LF, and surrounding whitespace
// is trimmed.
export type ArbostarLeadNotes = {
	lead_id: number
	/** The "Lead Description" box on the lead profile — what the office writes at intake. */
	lead_body: string
	/** Free text behind the "Other" lead source choice ("Nextdoor", "JobsFuel", ...); '' on every other lead. */
	lead_source_details: string
	/** The estimate's crew notes. */
	estimate_crew_notes: string
	/** The estimate's office notes. */
	estimate_office_notes: string
}

// lead_notes.js is an ESM module whose default export is the full array of records.
declare const leadNotes: ArbostarLeadNotes[]
export default leadNotes
