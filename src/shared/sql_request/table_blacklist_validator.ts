import { for_each } from "#shared/array.ts"
import type { SafeSelectQuery, TableSource } from "./safe_select_query_validator.ts"

type SchemaColumns = {
	[table_name in string]: unknown
}

export default <ThisSchema extends SchemaColumns>(blacklist: (keyof ThisSchema)[]) => {
	const blacklist_set = new Set<keyof ThisSchema>(blacklist)

	const collect_messages = (query: SafeSelectQuery, messages: string[]): void => {
		const check_source = (source: TableSource) => {
			if ('subquery' in source) {
				collect_messages(source.subquery, messages)
			} else if (blacklist_set.has(source.table_name)) {
				messages.push(`Table "${source.table_name}" is blacklisted`)
			}
		}

		check_source(query.from)
		for_each(query.joins, check_source)
	}

	return (query: SafeSelectQuery) => {
		const messages: string[] = []
		collect_messages(query, messages)
		return messages
	}
}
