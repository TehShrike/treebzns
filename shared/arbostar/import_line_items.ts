import type { Connection } from 'mysql2/promise'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import { map, filter } from '#shared/array.ts'
import { insert_helper, ROWS_PER_BATCH, join_lines, money } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'

export type ImportedLineItems = {
	counts: {
		item_types: number
		project_line_items: number
		skipped_line_items_without_project: number
	}
}

// line_items.js → item_type + project_line_item. Distinct service names become item types.
export const import_line_items = async (
	connection: Connection,
	context: ArbostarImportContext,
	line_items: ArbostarLineItem[],
	project_id_by_arbostar_lead_id: Map<number, bigint>,
): Promise<ImportedLineItems> => {
	const importable = filter(line_items, item => project_id_by_arbostar_lead_id.has(item.lead_id))

	const taxable_by_service_name = new Map<string, boolean>()
	for (const item of importable) {
		if (item.service_name !== null && !taxable_by_service_name.has(item.service_name)) {
			taxable_by_service_name.set(item.service_name, !item.non_taxable)
		}
	}
	const service_names = [...taxable_by_service_name.keys()]

	const item_type_id_by_name = new Map<string, bigint>()
	if (service_names.length > 0) {
		const item_type_rows = map(service_names, name => ({
			company_id: context.company_id,
			name,
			taxable: taxable_by_service_name.get(name)!,
		}))
		const { insert_ids } = await insert_helper.bulk_insert(connection, 'item_type', item_type_rows, ROWS_PER_BATCH)
		service_names.forEach((name, index) => item_type_id_by_name.set(name, insert_ids[index]!))
	}

	if (importable.length > 0) {
		const line_item_rows = map(importable, item => {
			const description = join_lines([
				item.description,
				item.size === null ? null : `Size: ${item.size}`,
				item.species === null ? null : `Species: ${item.species}`,
				item.reason === null ? null : `Reason: ${item.reason}`,
			])
			return {
				company_id: context.company_id,
				project_id: project_id_by_arbostar_lead_id.get(item.lead_id)!,
				description: description === '' ? null : description,
				item_type_id: item.service_name === null ? null : item_type_id_by_name.get(item.service_name)!,
				estimated_hours: BigInt(Math.round(item.man_hours ?? 0)),
				taxable: !item.non_taxable,
				quantity: money(item.quantity ?? 1),
				price: money(item.price ?? 0),
			}
		})
		await insert_helper.bulk_insert(connection, 'project_line_item', line_item_rows, ROWS_PER_BATCH)
	}

	return {
		counts: {
			item_types: service_names.length,
			project_line_items: importable.length,
			skipped_line_items_without_project: line_items.length - importable.length,
		},
	}
}
