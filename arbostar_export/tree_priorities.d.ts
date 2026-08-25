// Shape of one element in arbostar_export/tree_priorities.js (see export_tree_inventory.ts).
// The tree condition/priority codebook — the values behind a tree's `priority`. Global
// reference data, from POST /treeInventory/markersPriority/loadData. Join a tree's `priority`
// (tree_inventory.js) to this table's `priority`. Despite the "priority" name, the values are
// tree conditions: Low, Mid, High, Excellent, Good, Fair, ...
export type ArbostarTreePriority = {
	/** Numeric row id (the catalog's `tip_id`). */
	tip_id: number
	/** Condition code, e.g. 'good', 'fair'. A tree's `priority` references it. */
	priority: string
	/** Display label, e.g. 'Good', 'Mid'. */
	priority_label: string
	/** Display color, e.g. '#FFD23D'. */
	color: string
}

// tree_priorities.js is an ESM module whose default export is the full array of records.
declare const treePriorities: ArbostarTreePriority[]
export default treePriorities
