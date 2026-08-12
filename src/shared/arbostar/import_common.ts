// Shared pieces of the ArboStar → current-schema import (see import_arbostar_export.ts for
// the orchestrator and arbostar_import_notes.md for what does/doesn't survive the mapping).
import type { Connection, Pool, RowDataPacket } from 'mysql2/promise'
import type { InsertableSchema, Schema } from '#schema/types.ts'
import * as schema from '#schema/all_table_column_names.ts'
import * as insertable_schema from '#schema/insertable_table_column_names.ts'
import typed_write_helper from '#shared/sql_request/typed_write_helper.ts'
import { make_safe_query_builder } from '#shared/sql_request/safe_sql_query.ts'
import { map, filter } from '#shared/array.ts'
import arbostar_number_to_fnum from './arbostar_number_to_fnum.ts'
import type { ExistingCorrelations } from './load_existing_correlations.ts'

export const write_helper = typed_write_helper<InsertableSchema, Schema>(schema, insertable_schema)

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
		declined_proposal: bigint
		cancelled_work_order: bigint
	}
	// Normalized reason (see normalize_name) → project_decline_reason_id for the company's
	// canned decline reasons.
	decline_reason_id_by_reason: Map<string, bigint>
	// Normalized employee name (see normalize_name) → employee_id, for the company's existing
	// employees. import_employees folds the imported ArboStar users into this map before it's
	// used to match estimator names.
	employee_id_by_name: Map<string, bigint>
	// Identity key (see identity_key) of the company's existing employees' email and
	// login_name → employee_id, so an ArboStar user account can adopt the employee row a
	// person created in-app before the first import.
	employee_id_by_identity: Map<string, bigint>
	// The company's rows from previous imports (see load_existing_correlations.ts) — how each
	// importer decides update-vs-insert. All empty on a first import.
	existing: ExistingCorrelations
}

export const normalize_name = (name: string): string => name.trim().toLowerCase()

// Identity keys (email / login_name) are unique across the whole employee table with
// case-insensitive collation.
export const identity_key = (value: string): string => value.trim().toLowerCase()

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

// Currency columns are 2 decimal places: strip ArboStar's float noise first, then round to
// the column's scale.
export const money = (value: number) => arbostar_number_to_fnum(value).changeDecimalPlaces(2)

export const money_display = (value: number | null): string | null =>
	(value === null ? null : `$${arbostar_number_to_fnum(value).changeDecimalPlaces(2).toString()}`)

export const string_or_null = (value: string | null | []): string | null => (typeof value === 'string' ? value : null)
