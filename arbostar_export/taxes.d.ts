// Shape of one element in arbostar_export/taxes.js (see export_taxes.ts).
// The company's official tax list, scraped from the /settings page's hidden #allTaxes
// input — the same entries the estimate/invoice tax dropdowns offer.
export type ArbostarTax = {
	/** Display key, e.g. "Tax (5.5%)"; the system default is suffixed " - System default". */
	id: string
	/** Same as id. */
	text: string
	/** Bare tax name, e.g. "Tax"; empty for the unnamed entry. */
	name: string
	/** Total multiplier: 1 + value/100 (5.5% → 1.055). */
	rate: number
	/** The percentage, e.g. 5.5. */
	value: number
	/** Display key again for editable entries, empty for the system default. */
	edit: string
}

// taxes.js is an ESM module whose default export is the full array of records.
declare const taxes: ArbostarTax[]
export default taxes
