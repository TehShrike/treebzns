// Shape of one element in arbostar_export/tree_inventory_sets.js (see export_tree_inventory.ts).
// One row per tree inventory set that holds at least one tree. A set is a client's property
// map. Set-level fields come from /treeInventory/show/{tis_id}; the trees themselves are in
// tree_inventory.js (join on tis_id).
export type ArbostarTreeInventorySet = {
	/** Set id. Join to tree_inventory.js `tis_id`. */
	tis_id: number
	/** Set name, usually the property address, e.g. 'Phoebe-1'. */
	tis_name: string
	/** Owning client. Join to clients.js `client_id`. */
	tis_client_id: number
	tis_address: string
	tis_city: string
	tis_state: string
	tis_zip: string
	tis_country: string
	/** Map center latitude (WGS84). */
	tis_lat: number
	/** Map center longitude (WGS84). */
	tis_lng: number
	/** Number of trees on the set (matches the row count in tree_inventory.js for this tis_id). */
	markers_count: number
	/** Unix seconds. null on one set. */
	created_at: number | null
	/** Unix seconds. */
	updated_at: number | null
	/** null on every set so far. */
	deleted_at: string | null
	/** The map overlay image path. null on every set so far. */
	overlay_path: string | null
	/** null on every set so far. Raw. */
	file: unknown
	/** Estimates made from this set's map. Join `estimate_id` to estimates.js. */
	estimates: { estimate_id: number; estimate_no: string }[]
}

// tree_inventory_sets.js is an ESM module whose default export is the full array of records.
declare const treeInventorySets: ArbostarTreeInventorySet[]
export default treeInventorySets
