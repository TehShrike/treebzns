import type { Connection, ResultSetHeader } from 'mysql2/promise'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import { map, filter } from '#shared/array.ts'
import { insert_helper, ROWS_PER_BATCH, join_lines, money, normalize_name } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'

export type ImportedLineItems = {
	counts: {
		item_types_inserted: number
		project_line_items_inserted: number
		project_line_items_updated: number
		project_line_items_deleted: number
		skipped_line_items_without_project: number
		duplicate_line_items_dropped: number
	}
}

// ArboStar's estimate editor payload reuses a handful of line ids: the June 2026 export has 13
// ids appearing twice — one real row and one phantom (null service/price/quantity) on an
// unrelated newer lead. Keep whichever copy carries the most data.
const data_score = (item: ArbostarLineItem): number =>
	(item.service_name === null ? 0 : 1) + (item.price === null ? 0 : 1) + (item.quantity === null ? 0 : 1)

// A Declined line is imported as client_optional even when ArboStar didn't flag it optional:
// this schema only allows declining optional lines, and a declined line's fate (never billed —
// verified against invoice totals) matters more than how it was originally offered.
// line_items.js → item_type + project_line_item, update-or-insert. Item types are naturally
// keyed by name per company — existing ones are reused (their taxable flag is left as set at
// creation), only unseen names are inserted. Line items correlate by arbostar_line_item_id,
// and ones that disappeared from the export are deleted — stale lines would inflate project
// totals, which derive from line items — but only within projects present in this run, so a
// lead missing from a (possibly partial) export keeps its lines just like it keeps its
// project. In-app lines (null arbostar id) are never touched.
export const import_line_items = async (
	connection: Connection,
	context: ArbostarImportContext,
	line_items: ArbostarLineItem[],
	project_id_by_arbostar_lead_id: Map<number, bigint>,
): Promise<ImportedLineItems> => {
	const with_project = filter(line_items, item => project_id_by_arbostar_lead_id.has(item.lead_id))
	const best_by_line_item_id = new Map<number, ArbostarLineItem>()
	for (const item of with_project) {
		const current = best_by_line_item_id.get(item.line_item_id)
		if (current === undefined || data_score(item) > data_score(current)) best_by_line_item_id.set(item.line_item_id, item)
	}
	const importable = [...best_by_line_item_id.values()]

	const item_type_id_by_name = new Map(context.existing.item_type_id_by_name)
	const normalized_item_type_name_to_new_item_type = new Map<string, { name: string; taxable: boolean }>()
	for (const item of importable) {
		if (item.service_name === null) continue
		const normalized_name = normalize_name(item.service_name)
		if (!item_type_id_by_name.has(normalized_name) && !normalized_item_type_name_to_new_item_type.has(normalized_name)) {
			normalized_item_type_name_to_new_item_type.set(normalized_name, { name: item.service_name.trim(), taxable: !item.non_taxable })
		}
	}
	const new_item_types = [...normalized_item_type_name_to_new_item_type.entries()]

	if (new_item_types.length > 0) {
		const item_type_rows = map(new_item_types, ([, { name, taxable }]) => ({
			company_id: context.company_id,
			name,
			taxable,
		}))
		const { insert_ids } = await insert_helper.bulk_insert(connection, 'item_type', item_type_rows, ROWS_PER_BATCH)
		new_item_types.forEach(([normalized_name], index) => item_type_id_by_name.set(normalized_name, insert_ids[index]!))
	}

	const line_item_fields = (item: ArbostarLineItem) => {
		const description = join_lines([
			item.description,
			item.size === null ? null : `Size: ${item.size}`,
			item.species === null ? null : `Species: ${item.species}`,
			item.reason === null ? null : `Reason: ${item.reason}`,
		])
		return {
			project_id: project_id_by_arbostar_lead_id.get(item.lead_id)!,
			description: description === '' ? null : description,
			item_type_id: item.service_name === null ? null : item_type_id_by_name.get(normalize_name(item.service_name))!,
			estimated_hours: BigInt(Math.round(item.man_hours ?? 0)),
			taxable: !item.non_taxable,
			client_optional: item.optional || item.status === 'Declined',
			client_declined: item.status === 'Declined',
			quantity: money(item.quantity ?? 1),
			price: money(item.price ?? 0),
		}
	}

	const correlated = context.existing.project_line_item_id_by_arbostar_line_item_id
	const existing_items = filter(importable, item => correlated.has(item.line_item_id))
	const new_items = filter(importable, item => !correlated.has(item.line_item_id))

	await insert_helper.bulk_update(
		connection,
		'project_line_item',
		'project_line_item_id',
		map(existing_items, item => ({ key: correlated.get(item.line_item_id)!, set: line_item_fields(item) })),
		ROWS_PER_BATCH,
	)
	if (new_items.length > 0) {
		await insert_helper.bulk_insert(
			connection,
			'project_line_item',
			map(new_items, item => ({
				company_id: context.company_id,
				...line_item_fields(item),
				arbostar_line_item_id: BigInt(item.line_item_id),
			})),
			ROWS_PER_BATCH,
		)
	}

	const incoming_id_list = map(importable, item => escape_value(item.line_item_id)).join(', ')
	const imported_project_ids = [...project_id_by_arbostar_lead_id.values()]
	const imported_project_id_list = map(imported_project_ids, escape_value).join(', ')
	const deleted = imported_project_ids.length === 0 ? 0 : await (async () => {
		const [{ affectedRows }] = await connection.query<ResultSetHeader>(
			`DELETE FROM project_line_item WHERE company_id = ${escape_value(context.company_id)}`
			+ ' AND arbostar_line_item_id IS NOT NULL'
			+ ` AND project_id IN (${imported_project_id_list})`
			+ (importable.length > 0 ? ` AND arbostar_line_item_id NOT IN (${incoming_id_list})` : ''),
		)
		return affectedRows
	})()

	return {
		counts: {
			item_types_inserted: new_item_types.length,
			project_line_items_inserted: new_items.length,
			project_line_items_updated: existing_items.length,
			project_line_items_deleted: deleted,
			skipped_line_items_without_project: line_items.length - with_project.length,
			duplicate_line_items_dropped: with_project.length - importable.length,
		},
	}
}
