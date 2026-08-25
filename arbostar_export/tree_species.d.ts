// Shape of one element in arbostar_export/tree_species.js (see export_tree_inventory.ts).
// The tree species catalog — the dropdown behind a tree's species. Global reference data
// (not per client), from POST /treeInventory/trees/loadData. Join a tree's `species_id`
// (tree_inventory.js) to this table's `species_id`.
export type ArbostarTreeSpecies = {
	/** Species id. The `id` field of the catalog; a tree's `species_id` references it. */
	species_id: number
	/** Species name, e.g. 'Fir (Abies)', 'Eastern Cottonwood (Populus deltoides)'. */
	species_name: string
	/** Default pin color for the species, e.g. '#139148'. */
	species_color: string
}

// tree_species.js is an ESM module whose default export is the full array of records.
declare const treeSpecies: ArbostarTreeSpecies[]
export default treeSpecies
