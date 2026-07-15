// Shared pieces of the ArboStar → current-schema import (see import_arbostar_export.ts for
// the orchestrator and arbostar_import_notes.md for what does/doesn't survive the mapping).
import type { Connection, Pool, RowDataPacket } from 'mysql2/promise'
import type { InsertableSchema } from '#schema/types.ts'
import * as schema from '#schema/all_table_column_names.ts'
import * as insertable_schema from '#schema/insertable_table_column_names.ts'
import typed_insert_helper from '#shared/sql_request/typed_insert_helper.ts'
import { make_safe_query_builder } from '#shared/sql_request/safe_sql_query.ts'
import fnum from '#shared/number.ts'
import { map, filter } from '#shared/array.ts'
import type { ExistingCorrelations } from './load_existing_correlations.ts'

export const insert_helper = typed_insert_helper<InsertableSchema>(schema, insertable_schema)

export const ROWS_PER_BATCH = 1000

const { to_sql } = make_safe_query_builder(schema)

// Accepts a pool as well as a connection: pool-run selects each use their own connection, so
// independent queries genuinely run in parallel instead of pipelining on one connection.
export const run_select = async <Row>(
	connection: Connection | Pool,
	built: { query: Parameters<typeof to_sql>[0]; positional_row_to_named: (row: unknown[]) => Row },
): Promise<Row[]> => {
	const { sql, values } = to_sql(built.query)
	const [rows] = await connection.query<RowDataPacket[]>({ sql, values, rowsAsArray: true })
	return map(rows as unknown as unknown[][], row => built.positional_row_to_named(row))
}

// Employees need at least one identity column; users without one (or whose identity collides
// with the globally unique email/login_name keys) get a synthesized address. Scoped by company
// because two ArboStar tenants can both have a user 5.
export const placeholder_email = (company_id: bigint, arbostar_user_id: number): string =>
	`arbostar.user.${arbostar_user_id}@company.${company_id}.import.invalid`

export type ArbostarImportContext = {
	company_id: bigint
	// Imported projects are attributed to this employee (project.created_by_employee_id).
	created_by_employee_id: bigint
	// Resolved from the global project_document codebook by behavior flags (see resolve_context).
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
	// The company's rows from previous imports (see load_existing_correlations.ts) — how each
	// importer decides update-vs-insert. All empty on a first import.
	existing: ExistingCorrelations
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
