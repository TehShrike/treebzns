// Shape of one element in arbostar_export/tree_inventory.js (see export_tree_inventory.ts).
// One row per tree — a marker on a client's property map. Trees come from the unauthenticated
// markers microservice as GeoJSON features; this is the flattened, curated form.
//
// A tree belongs to a tree inventory set (`tis_id`). Join `tis_id` to tree_inventory_sets.js
// for the set's client (`tis_client_id`) and address.
export type ArbostarTree = {
	/** Marker/tree record id (the feature's `ti_id`). Unique per tree. */
	ti_id: number
	/** The tree inventory set this tree sits on. Join to tree_inventory_sets.js. */
	tis_id: number
	/** Label shown on the map pin, e.g. '8'. Not unique across sets. */
	tree_number: string
	/** Species id (the feature's `ti_tree_type`), from the /treeInventory/trees catalog. */
	species_id: number | null
	/** Species name, e.g. 'Eastern Cottonwood (Populus deltoides)'. */
	species_name: string | null
	/** Species pin color, e.g. '#139148'. */
	species_color: string | null
	/** Condition/priority code, e.g. 'good', 'fair', 'poor'. */
	priority: string | null
	/** Condition/priority label, e.g. 'Good'. */
	priority_label: string | null
	/** Free-text size note (DBH / height), as entered. May be null. */
	size: string | null
	/** Removal cost for the tree. Raw number from the API. */
	cost: number
	/** Stump-grinding cost. Raw number from the API. */
	stump_cost: number
	/** Free-text remark, or null. */
	remark: string | null
	/** Latitude of the pin (WGS84). */
	lat: number
	/** Longitude of the pin (WGS84). */
	lng: number
	/** Pruning work types attached to the tree (the `ip_*` catalog). Raw, often empty. */
	work_types: unknown[]
	/** Recommended services attached to the tree. Raw, often empty. */
	recommended_services: unknown[]
	/** Attached files/photos. Raw, often empty. */
	files: unknown[]
}

// tree_inventory.js is an ESM module whose default export is the full array of records.
declare const treeInventory: ArbostarTree[]
export default treeInventory
