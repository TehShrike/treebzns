import type { Comparison, SafeSqlQuery, WhereGrouping } from "./safe_sql_query_validator.ts"

type SchemaColumns = {
	[table_name in string]: {
		[column_name in string]: column_name
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

const prep_tenant_function = <
	ThisSchema extends SchemaColumns,
	NonTenantedTableNames extends keyof ThisSchema
>({
	schema,
	non_tenanted_table_names,
	column_name,
}: {
	schema: ThisSchema
	non_tenanted_table_names: NonTenantedTableNames[]
	column_name: TenantColumn<ThisSchema, NonTenantedTableNames>
}) => {
	const non_tenanted_table_names_set = new Set<keyof ThisSchema>(non_tenanted_table_names)
	return (query: SafeSqlQuery, value: any): SafeSqlQuery => {
		const where = non_tenanted_table_names_set.has(query.from.table_name)
			? query.where
			: add_tenant_filter_to_where_clause<ThisSchema, NonTenantedTableNames>({
				where: query.where,
				table_identifier: query.from.table_name,
				column_name,
				value,
			})

		return {
			...query,
			where,
		}
	}
}

export default prep_tenant_function
