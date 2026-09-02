import type { Comparison, SafeSelectQuery, TableSource } from "./safe_select_query_validator.ts"
import { map } from "../array.ts"

type SchemaColumns = {
	[table_name in string]: {
		[column_name in string]: unknown
	}
}

type TenantColumn<
	ThisSchema extends SchemaColumns,
	NonTenantedTableNames extends keyof ThisSchema,
> = (keyof ThisSchema[Exclude<keyof ThisSchema, NonTenantedTableNames>]) & string

const prep_tenant_function = <
	ThisSchema extends SchemaColumns,
	NonTenantedTableNames extends keyof ThisSchema
>({
	non_tenanted_table_names,
	column_name,
}: {
	non_tenanted_table_names: NonTenantedTableNames[]
	column_name: TenantColumn<ThisSchema, NonTenantedTableNames>
}) => {
	const non_tenanted_table_names_set = new Set<keyof ThisSchema>(non_tenanted_table_names)

	const tenant_filter = (table_identifier: string, value: any): Comparison => ({
		type: 'comparison',
		left: {
			type: 'column reference',
			table_identifier,
			column: column_name,
		},
		comparator: '=',
		right: {
			type: 'user provided value',
			value,
		},
	})

	// A derived table is tenanted by recursing into its subquery, so it needs no filter of its own.
	const tenant_source = (source: TableSource, value: any): { source: TableSource, filter: Comparison | null } => {
		if ('subquery' in source) {
			return { source: { ...source, subquery: make_tenanted_query(source.subquery, value) }, filter: null }
		}
		if (non_tenanted_table_names_set.has(source.table_name)) {
			return { source, filter: null }
		}
		return { source, filter: tenant_filter(source.alias, value) }
	}

	const make_tenanted_query = (query: SafeSelectQuery, value: any): SafeSelectQuery => {
		const from = tenant_source(query.from, value)

		const where = from.filter === null
			? query.where
			: {
				type: 'and' as const,
				expressions: query.where ? [from.filter, query.where] : [from.filter],
			}

		const joins = map(query.joins, join => {
			const { source, filter } = tenant_source(join, value)
			return {
				...join,
				...source,
				on_clause: filter === null ? join.on_clause : [filter, ...join.on_clause],
			}
		})

		return {
			...query,
			from: from.source,
			where,
			joins,
		}
	}
	return make_tenanted_query
}

export default prep_tenant_function
