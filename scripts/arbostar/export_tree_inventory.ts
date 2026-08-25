// Run-now export: pulls the whole tree inventory and writes four files —
//   tree_inventory.js       one row per tree
//   tree_inventory_sets.js  one row per set that has trees (client + address)
//   tree_species.js         the global species catalog (a tree's species_id → here)
//   tree_priorities.js      the global condition/priority codebook (a tree's priority → here)
//
//   node scripts/arbostar/export_tree_inventory.ts
//
// Trees do not live in the main ArboStar app. They are markers in a separate microservice
// (session.MAP_MARKERS_URL), stored one search index per tree inventory set, named
// `{subdomain}-treeInventory-{tis_id}`. That service is UNAUTHENTICATED — it trusts the index
// name — so we read it with plain fetch, no cookies. It does not support a wildcard index, so
// there is no single "all trees" query.
//
// A set (`tis_id`) is a client's property map. The main app keys sets by client
// (/treeInventory/indexData/{client_id}), so listing every set the app's own way needs one
// request per client (~1700). Instead we walk the global tis_id sequence directly against the
// markers service: start at 0, ask each index for its markers, and stop after EMPTY_RUN_LIMIT
// tis_ids in a row return nothing. Empty sets do occur inside the used range (a set is
// auto-created for a client the first time its map opens, before any tree is added), so the
// limit must clear the largest such gap. Sets holding trees are then enriched one by one from
// /treeInventory/show/{tis_id} (only the non-empty ones — cheap) for their client + address.
//
// Auth for the show enrichment comes from ./session.ts. Shapes are committed in
// #arbostar_export/tree_inventory.d.ts and #arbostar_export/tree_inventory_sets.d.ts.

import assert from '#shared/assert.ts'
import { for_each, for_each_async, map } from '#shared/array.ts'
import { write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import { AUTH_HEADERS, BASE_URL, MAP_MARKERS_URL, SUBDOMAIN } from './session.ts'
import type { ArbostarTree } from '#arbostar_export/tree_inventory.d.ts'
import type { ArbostarTreeInventorySet } from '#arbostar_export/tree_inventory_sets.d.ts'
import type { ArbostarTreeSpecies } from '#arbostar_export/tree_species.d.ts'
import type { ArbostarTreePriority } from '#arbostar_export/tree_priorities.d.ts'

// Stop after this many consecutive tis_ids return no trees. Must exceed the longest run of
// empty sets inside the used range (largest gap seen: 5).
const EMPTY_RUN_LIMIT = 10
const START_TIS_ID = 0

type RawTreeMeta = { trees_id: number; trees_title: string; trees_color: string }
type RawPriorityMeta = { id: string; text: string }

// One GeoJSON feature from the markers service = one tree. Only the fields we read are typed.
type RawFeature = {
	ti_id: number
	ti_tis_id: number
	ti_tree_number: string
	ti_tree_type: number | null
	ti_size: string | null
	ti_cost: number
	ti_stump_cost: number
	ti_remark: string | null
	tree: RawTreeMeta | null
	tree_priority: RawPriorityMeta | null
	work_types?: unknown[]
	recommended_services?: unknown[]
	files?: unknown[]
	lat: number
	lng: number
	geometry: { type: string; coordinates: [number, number] }
}

type MarkersResponse = {
	type: string
	features: RawFeature[]
	marker_count: number
	marker_count_total: number
}

type RawSet = {
	tis_id: number
	tis_name: string
	tis_client_id: number
	tis_address: string
	tis_city: string
	tis_state: string
	tis_zip: string
	tis_country: string
	tis_lat: number
	tis_lng: number
	markers_count: number
}

// Both catalogs are select2-style dropdown feeds: { items: [...], total_count }.
type RawSpecies = { id: number; text: string; color: string }
type RawPriority = { tip_id: number; id: string; text: string; color: string }
type CatalogResponse<Item> = { items: Item[]; total_count: number }

/** Query the markers microservice for one set. Unauthenticated. `perPage: -1` returns every tree. */
async function fetch_markers(tis_id: number): Promise<RawFeature[]> {
	const search_index = `${SUBDOMAIN}-treeInventory-${tis_id}`
	const response = await fetch(`${MAP_MARKERS_URL}/markers`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ searchIndex: search_index, filters: {}, perPage: -1 }),
	})
	if (!response.ok) {
		throw new Error(`markers ${search_index} failed: ${response.status} ${response.statusText}`)
	}
	const body = (await response.json()) as MarkersResponse
	return body.features
}

/** Load one set's metadata (client + address) from the main app. Needs the session auth. */
async function fetch_set(tis_id: number): Promise<RawSet> {
	const response = await fetch(`${BASE_URL}/treeInventory/show/${tis_id}`, {
		method: 'POST',
		credentials: 'include',
		headers: {
			accept: 'application/json, text/javascript, */*; q=0.01',
			'x-requested-with': 'XMLHttpRequest',
			'content-type': 'application/x-www-form-urlencoded',
			...AUTH_HEADERS,
		},
		body: `tis_id=${tis_id}`,
	})
	if (response.status === 302 || response.status === 401) {
		throw new Error(
			`treeInventory/show/${tis_id} failed: ${response.status} — stale session. Refresh scripts/arbostar/.arbostar_session.json (see readme).`,
		)
	}
	if (!response.ok) {
		throw new Error(`treeInventory/show/${tis_id} failed: ${response.status} ${response.statusText}`)
	}
	const body = (await response.json()) as { data: RawSet }
	return body.data
}

// The dropdown catalogs page at 100 items (perPage overrides are ignored / error), so walk
// `page` until we have all `total_count` rows.
async function fetch_catalog<Item>(path: string): Promise<Item[]> {
	const items: Item[] = []
	let page = 1
	let total = Infinity
	while (items.length < total) {
		const response = await fetch(`${BASE_URL}${path}`, {
			method: 'POST',
			credentials: 'include',
			headers: {
				accept: 'application/json, text/javascript, */*; q=0.01',
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded',
				...AUTH_HEADERS,
			},
			body: `page=${page}`,
		})
		if (response.status === 302 || response.status === 401) {
			throw new Error(
				`${path} failed: ${response.status} — stale session. Refresh scripts/arbostar/.arbostar_session.json (see readme).`,
			)
		}
		if (!response.ok) {
			throw new Error(`${path} failed: ${response.status} ${response.statusText}`)
		}
		const body = (await response.json()) as CatalogResponse<Item>
		total = body.total_count
		if (body.items.length === 0) break
		for_each(body.items, item => items.push(item))
		page += 1
	}
	return items
}

function map_tree(feature: RawFeature): ExportShape<ArbostarTree> {
	const [lng, lat] = feature.geometry?.coordinates ?? [feature.lng, feature.lat]
	return {
		ti_id: feature.ti_id,
		tis_id: feature.ti_tis_id,
		tree_number: feature.ti_tree_number,
		species_id: feature.ti_tree_type,
		species_name: feature.tree?.trees_title ?? null,
		species_color: feature.tree?.trees_color ?? null,
		priority: feature.tree_priority?.id ?? null,
		priority_label: feature.tree_priority?.text ?? null,
		size: feature.ti_size,
		cost: feature.ti_cost,
		stump_cost: feature.ti_stump_cost,
		remark: feature.ti_remark,
		lat,
		lng,
		work_types: feature.work_types ?? [],
		recommended_services: feature.recommended_services ?? [],
		files: feature.files ?? [],
	}
}

const trees: ExportShape<ArbostarTree>[] = []
const set_ids_with_trees: number[] = []

let empty_run = 0
let tis_id = START_TIS_ID
while (empty_run < EMPTY_RUN_LIMIT) {
	const features = await fetch_markers(tis_id)
	if (features.length === 0) {
		empty_run += 1
	} else {
		empty_run = 0
		set_ids_with_trees.push(tis_id)
		for_each(features, feature => trees.push(map_tree(feature)))
		console.log(`tis ${tis_id}: ${features.length} trees`)
	}
	tis_id += 1
}

console.log(
	`Scanned tis ${START_TIS_ID}..${tis_id - 1}: ${trees.length} trees across ${set_ids_with_trees.length} sets.`,
)

// The trees come from the unauthenticated markers service, so write them before the authed
// set enrichment. A stale session then costs only tree_inventory_sets.js, not the tree data.
const trees_path = write_output('tree_inventory.js', trees)
console.log(`Wrote ${trees.length} trees to ${trees_path}`)

const sets: ExportShape<ArbostarTreeInventorySet>[] = []
await for_each_async(set_ids_with_trees, async id => {
	const set = await fetch_set(id)
	// Every set the markers walk found must map back to a client, or the join to clients.js breaks.
	assert(
		typeof set.tis_client_id === 'number' && set.tis_client_id > 0,
		`tree inventory set ${id} has a client id`,
	)
	sets.push({
		tis_id: set.tis_id,
		tis_name: set.tis_name,
		tis_client_id: set.tis_client_id,
		tis_address: set.tis_address,
		tis_city: set.tis_city,
		tis_state: set.tis_state,
		tis_zip: set.tis_zip,
		tis_country: set.tis_country,
		tis_lat: set.tis_lat,
		tis_lng: set.tis_lng,
		markers_count: set.markers_count,
	})
})

const sets_path = write_output('tree_inventory_sets.js', sets)
console.log(`Wrote ${sets.length} tree inventory sets to ${sets_path}`)

// Global reference catalogs a tree points into: species (ti_tree_type) and condition (priority).
const raw_species = await fetch_catalog<RawSpecies>('/treeInventory/trees/loadData')
const species: ExportShape<ArbostarTreeSpecies>[] = map(raw_species, s => ({
	species_id: s.id,
	species_name: s.text,
	species_color: s.color,
}))
const species_path = write_output('tree_species.js', species)
console.log(`Wrote ${species.length} tree species to ${species_path}`)

const raw_priorities = await fetch_catalog<RawPriority>('/treeInventory/markersPriority/loadData')
const priorities: ExportShape<ArbostarTreePriority>[] = map(raw_priorities, p => ({
	tip_id: p.tip_id,
	priority: p.id,
	priority_label: p.text,
	color: p.color,
}))
const priorities_path = write_output('tree_priorities.js', priorities)
console.log(`Wrote ${priorities.length} tree priorities to ${priorities_path}`)
