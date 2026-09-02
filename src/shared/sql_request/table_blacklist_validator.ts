import { for_each } from "#shared/array.ts"
import type { SafeSelectQuery } from "./safe_select_query_validator.ts"

type SchemaColumns = {
	[table_name in string]: unknown
}

export default <ThisSchema extends SchemaColumns>(blacklist: (keyof ThisSchema)[]) => {
	const blacklist_set = new Set<keyof ThisSchema>(blacklist)

	const collect_messages = (query: SafeSelectQuery, messages: string[]): void => {
		for_each(query.joins, join => {
			if (blacklist_set.has(join.table_name)) {
				messages.push(`Table "${join.table_name}" is blacklisted`)
			}
		})

		if ('subquery' in query.from) {
			collect_messages(query.from.subquery, messages)
		} else if (blacklist_set.has(query.from.table_name)) {
			messages.push(`Table "${query.from.table_name}" is blacklisted`)
		}
	}

	return (query: SafeSelectQuery) => {
		const messages: string[] = []
		collect_messages(query, messages)
		return messages
	}
}
