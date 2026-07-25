import { for_each } from "#shared/array.ts"
import type { SafeSqlQuery } from "./safe_sql_query_validator.ts"

type SchemaColumns = {
	[table_name in string]: unknown
}

export default <ThisSchema extends SchemaColumns>(blacklist: (keyof ThisSchema)[]) => {
	const blacklist_set = new Set<keyof ThisSchema>(blacklist)

	return (query: SafeSqlQuery) => {
		const messages: string[] = []

		for_each(query.joins, join => {
			if (blacklist_set.has(join.table_name)) {
				messages.push(`Table "${join.table_name}" is blacklisted`)
			}
		})

		if (blacklist_set.has(query.from.table_name)) {
			messages.push(`Table "${query.from.table_name}" is blacklisted`)
		}

		return messages
	}
}
