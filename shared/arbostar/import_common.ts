// Shared pieces of the ArboStar → current-schema import (see import_arbostar_export.ts for
// the orchestrator and arbostar_import_notes.md for what does/doesn't survive the mapping).
import type { InsertableSchema } from '#schema/types.ts'
import * as schema from '#schema/all_table_column_names.ts'
import * as insertable_schema from '#schema/insertable_table_column_names.ts'
import typed_insert_helper from '#shared/sql_request/typed_insert_helper.ts'
import fnum from '#shared/number.ts'
import { map, filter } from '#shared/array.ts'

export const insert_helper = typed_insert_helper<InsertableSchema>(schema, insertable_schema)

export const ROWS_PER_BATCH = 1000

export type ArbostarImportContext = {
	company_id: bigint
	// Imported projects are attributed to this employee (project.created_by_employee_id).
	created_by_employee_id: bigint
	// Resolved from the global project_document codebook by name.
	project_document_ids: {
		lead_unqualified: bigint
		lead_qualified: bigint
		estimate: bigint
		work_order: bigint
		void: bigint
	}
	// Normalized employee name (see normalize_name) → employee_id, for the company's existing
	// employees. import_employees folds the imported ArboStar users into this map before it's
	// used to match estimator names.
	employee_id_by_name: Map<string, bigint>
}

export const normalize_name = (name: string): string => name.trim().toLowerCase()

export const group_by = <T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> => {
	const groups = new Map<K, T[]>()
	for (const item of items) {
		const k = key(item)
		const group = groups.get(k)
		if (group) group.push(item)
		else groups.set(k, [item])
	}
	return groups
}

export const join_lines = (parts: Array<string | null | undefined>): string =>
	filter(map(parts, part => part ?? ''), part => part !== '').join('\n')

export const money = (value: number) => fnum(value.toFixed(2))

export const money_display = (value: number | null): string | null =>
	(value === null ? null : `$${value.toFixed(2)}`)

export const string_or_null = (value: string | null | []): string | null => (typeof value === 'string' ? value : null)
