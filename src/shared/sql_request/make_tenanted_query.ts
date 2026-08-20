import type { Comparison, Join, SafeSelectQuery, WhereGrouping } from "./safe_select_query_validator.ts"
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

const add_tenant_filter_to_where_clause = <
	ThisSchema extends SchemaColumns,
	NonTenantedTableNames extends keyof ThisSchema,
>({
	where,
	table_identifier,
	column_name,
	value
}: {
	where: WhereGrouping | null,
	table_identifier: string
	column_name: TenantColumn<ThisSchema, NonTenantedTableNames>
	value: any
}): WhereGrouping => {
	const comparison: Comparison = {
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
	}

	return {
		type: 'and',
		expressions: where ? [comparison, where] : [comparison],
	}
}

const add_tenant_filter_to_join_clause = <
	ThisSchema extends SchemaColumns,
	NonTenantedTableNames extends keyof ThisSchema,
>({
	on_clause,
	table_identifier,
	column_name,
	value
}: {
	on_clause: Join['on_clause']
	table_identifier: string
	column_name: TenantColumn<ThisSchema, NonTenantedTableNames>
	value: any
}): Join['on_clause'] => {
	const comparison: Comparison = {
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
	}

	return [comparison, ...on_clause]
}

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
	return (query: SafeSelectQuery, value: any): SafeSelectQuery => {
		const where = non_tenanted_table_names_set.has(query.from.table_name)
			? query.where
			: add_tenant_filter_to_where_clause<ThisSchema, NonTenantedTableNames>({
				where: query.where,
				table_identifier: query.from.alias,
				column_name,
				value,
			})

		const joins = map(query.joins, join => non_tenanted_table_names_set.has(join.table_name)
			? join
			: {
				...join,
				on_clause: add_tenant_filter_to_join_clause<ThisSchema, NonTenantedTableNames>({
					on_clause: join.on_clause,
					table_identifier: join.alias,
					column_name,
					value,
				}),
			}
		)

		return {
			...query,
			where,
			joins,
		}
	}
}

export default prep_tenant_function
