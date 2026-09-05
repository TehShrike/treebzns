import type { Validator } from '#shared/json_validator.ts'
import {
	safe_select_query_validator,
	type SafeSelectQuery,
	type TableSource,
} from './safe_select_query_validator.ts'

const source_requires_transaction = (source: TableSource, visited: WeakSet<object>): boolean =>
	'subquery' in source && query_requires_transaction_inner(source.subquery, visited)

const query_requires_transaction_inner = (query: SafeSelectQuery, visited: WeakSet<object>): boolean => {
	if (visited.has(query)) return false
	visited.add(query)

	return query.for_update === true
		|| source_requires_transaction(query.from, visited)
		|| query.joins.some(join => source_requires_transaction(join, visited))
}

/** Whether a query, including any derived-table query, contains a transaction-only operation. */
export const query_requires_transaction = (query: SafeSelectQuery): boolean =>
	query_requires_transaction_inner(query, new WeakSet())

/** The validator used at public boundaries where transaction-only queries are never permitted. */
export const non_transactional_safe_select_query_validator: Validator<SafeSelectQuery> = {
	is_valid: (input): input is SafeSelectQuery =>
		safe_select_query_validator.is_valid(input) && !query_requires_transaction(input),
	get_messages: (input, name) => {
		const structural_messages = safe_select_query_validator.get_messages(input, name)
		if (structural_messages.length > 0 || !safe_select_query_validator.is_valid(input)) {
			return structural_messages
		}

		return query_requires_transaction(input)
			? [`"${name}" must not require a transaction`]
			: []
	},
}
