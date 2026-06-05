import type { Comparison, SafeSqlQuery } from "./safe_sql_query_validator.ts"

type SchemaColumns = {
	[table_name in string]: {
		[column_name in string]: column_name
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
	column_name: (keyof ThisSchema[Exclude<keyof ThisSchema, NonTenantedTableNames>]) & string
}) => {
	const non_tenanted_table_names_set = new Set<keyof ThisSchema>(non_tenanted_table_names)
	return (query: SafeSqlQuery, value: any): SafeSqlQuery => {
		if (!non_tenanted_table_names_set.has(query.from.table_name)) {
			const comparison: Comparison = {
				type: 'comparison',
				left: {
					type: 'column reference',
					table_identifier: query.from.table_name,
					column: column_name,
				},
				comparator: '=',
				right: {
					type: 'user provided value',
					value,
				},
			}

			const expressions = query.where ? [comparison, query.where] : [comparison]
			query.where = {
				type: 'and',
				expressions,
			}
		}
	}
}

export default prep_tenant_function
