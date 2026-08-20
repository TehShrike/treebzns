import table_blacklist_validator from '#shared/sql_request/table_blacklist_validator.ts'
import prep_tenant_function from '#shared/sql_request/make_tenanted_query.ts'
import type { SafeSelectQuery } from '#shared/sql_request/safe_select_query.ts'
import safe_select_query_builder from './safe_select_query_builder.ts'

const blacklist_validator = table_blacklist_validator(['employee_session', 'migration'])

export const make_tenanted_query = prep_tenant_function({
	non_tenanted_table_names: ['permission', 'project_document'],
	column_name: 'company_id',
})

const tenanted_query_builder = (company_id: bigint) => (query: SafeSelectQuery): { sql: string, values: unknown[] } => {
	const blacklisted_table_messages = blacklist_validator(query)
	if (blacklisted_table_messages.length > 0) {
		throw new Error(blacklisted_table_messages.join(', '))
	}

	const table_and_column_name_messages = safe_select_query_builder.validate_table_and_column_names(query)
	if (!table_and_column_name_messages.valid) {
		throw new Error(table_and_column_name_messages.messages.join(', '))
	}

	const tenanted_query = make_tenanted_query(query, company_id)
	return safe_select_query_builder.to_sql(tenanted_query)
}

export default tenanted_query_builder
