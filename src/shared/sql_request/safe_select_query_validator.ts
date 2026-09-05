import * as jv from '#shared/json_validator.ts'
import type { InferValidator, Validator } from '#shared/json_validator.ts'
import assert from '#shared/assert.ts'

const any_validator = jv.custom<any>({ is_valid: (_): _ is any => true, get_messages: () => [] })

// Identifiers (table names, column names, and aliases) are interpolated directly into the SQL
// string inside backticks rather than being parameterized, so they must be constrained to a safe
// character set. Word characters only — no backticks, whitespace, or other punctuation that could
// break out of the surrounding `...` quoting and inject SQL. Backticks in aliases aren't supported.
const identifier_pattern = /^\w+$/
const is_identifier = (input: unknown): input is string => typeof input === 'string' && identifier_pattern.test(input)
export const identifier_validator = jv.custom<string>({
	is_valid: is_identifier,
	get_messages: (input, name) => (is_identifier(input) ? [] : [`"${name}" must be a valid SQL identifier (letters, numbers, and underscores only)`]),
})

const column_reference_object_properties = {
	type: jv.exact('column reference' as const),
	table_identifier: identifier_validator,
	column: identifier_validator,
} as const

export const column_reference_validator = jv.object(column_reference_object_properties)

export const user_provided_value_validator = jv.object({
	type: jv.exact('user provided value' as const),
	value: any_validator,
})

export const comparator_validator = jv.one_of(
	jv.exact('>' as const),
	jv.exact('>=' as const),
	jv.exact('<' as const),
	jv.exact('!=' as const),
	jv.exact('<=' as const),
	jv.exact('<=>' as const),
	jv.exact('=' as const),
)

export const function_name_validator = jv.one_of(
	jv.exact('IS NOT NULL' as const),
	jv.exact('IS NULL' as const),
	jv.exact('COUNT' as const),
	jv.exact('COUNT DISTINCT' as const),
	jv.exact('UUID_TO_BIN' as const),
	jv.exact('MAX' as const),
	jv.exact('MIN' as const),
	jv.exact('SUM' as const),
	jv.exact('AVG' as const),
	jv.exact('IFNULL' as const),
)

const function_argument_validator = jv.one_of(column_reference_validator, user_provided_value_validator)

const function_validation_object = {
	type: jv.exact('function' as const),
	function: function_name_validator,
	arguments: jv.array(function_argument_validator),
}

export const function_expression_validator = jv.object(function_validation_object)

export const select_function_expression_validator = jv.object({
	...function_validation_object,
	alias: identifier_validator,
	table_identifier: identifier_validator,
})

export const comparison_validator = jv.object({
	type: jv.exact('comparison' as const),
	left: jv.one_of(column_reference_validator, user_provided_value_validator, function_expression_validator),
	comparator: comparator_validator,
	right: jv.one_of(column_reference_validator, user_provided_value_validator, function_expression_validator),
})

const column_reference_select_validator = jv.object({
	...column_reference_object_properties,
	alias: jv.optional(identifier_validator),
})

export const select_expression_validator = jv.one_of(
	column_reference_select_validator,
	select_function_expression_validator,
)

const table_addition_properties = {
	table_name: identifier_validator,
	alias: identifier_validator,
} as const

export const table_addition_validator = jv.object(table_addition_properties)

// An identifier emitted by the SELECT clause (a column alias, function alias, or grouping alias),
// referenced by name in ORDER BY / HAVING rather than re-qualified by table.
export const alias_reference_validator = jv.object({
	type: jv.exact('alias reference' as const),
	alias: identifier_validator,
})

export const order_by_direction_validator = jv.one_of(
	jv.exact('ASC' as const),
	jv.exact('DESC' as const),
)

// ORDER BY may sort by a table-qualified column, a function expression, or a select alias.
export const order_by_expression_validator = jv.one_of(
	column_reference_validator,
	function_expression_validator,
	alias_reference_validator,
)

export const order_by_validator = jv.object({
	expression: order_by_expression_validator,
	direction: order_by_direction_validator,
})

const is_positive_bigint = (input: unknown): input is bigint => typeof input === 'bigint' && input > 0n
export const limit_validator = jv.nullable(jv.custom<bigint>({
	is_valid: is_positive_bigint,
	get_messages: (input, name) => (is_positive_bigint(input) ? [] : [`"${name}" must be a positive bigint`]),
}))

// Recursive and/or grouping validator factory
export type AndOrGrouping<T> = {
	type: 'and' | 'or'
	expressions: Array<T | AndOrGrouping<T>>
}

const make_and_or_grouping_validator = <T extends object>(element_validator: Validator<T>): Validator<AndOrGrouping<T>> => {
	const holder: { v: Validator<AndOrGrouping<T>> | null } = { v: null }
	const lazy: Validator<AndOrGrouping<T>> = {
		is_valid: (input): input is AndOrGrouping<T> => holder.v!.is_valid(input),
		get_messages: (input, name) => holder.v!.get_messages(input, name),
	}
	holder.v = jv.object({
		type: jv.one_of(jv.exact('and' as const), jv.exact('or' as const)),
		expressions: jv.array(jv.one_of(element_validator, lazy)),
	}) as unknown as Validator<AndOrGrouping<T>>
	return holder.v
}

const make_select_grouping_validator = (): Validator<SelectGrouping> => {
	const holder: { v: Validator<SelectGrouping> | null } = { v: null }
	const lazy: Validator<SelectGrouping> = {
		is_valid: (input): input is SelectGrouping => holder.v!.is_valid(input),
		get_messages: (input, name) => holder.v!.get_messages(input, name),
	}
	holder.v = jv.object({
		type: jv.one_of(jv.exact('and' as const), jv.exact('or' as const)),
		expressions: jv.array(jv.one_of(select_expression_validator, lazy)),
		alias: jv.optional(identifier_validator),
	}) as unknown as Validator<SelectGrouping>
	return holder.v
}

export const select_grouping_validator = make_select_grouping_validator()
export const where_grouping_validator = make_and_or_grouping_validator(comparison_validator)

// HAVING filters on the aggregated result, so its operands are select aliases (or values) rather
// than raw table columns.
export const having_comparison_validator = jv.object({
	type: jv.exact('comparison' as const),
	left: jv.one_of(alias_reference_validator, user_provided_value_validator),
	comparator: comparator_validator,
	right: jv.one_of(alias_reference_validator, user_provided_value_validator),
})
export const having_grouping_validator = make_and_or_grouping_validator(having_comparison_validator)

const join_clause_properties = {
	on_clause: jv.array(jv.one_of(comparison_validator, function_expression_validator, where_grouping_validator)),
	left: jv.optional(jv.is_boolean),
} as const

// FROM and each JOIN may be a derived table: a nested query whose selected identifiers become the
// columns of `alias`.
const make_safe_select_query_validator = (): Validator<SafeSelectQuery> => {
	const holder: { v: Validator<SafeSelectQuery> | null } = { v: null }
	const lazy: Validator<SafeSelectQuery> = {
		is_valid: (input): input is SafeSelectQuery => {
			// @ts-expect-error v will be assigned
			return holder.v.is_valid(input)
		},
		get_messages: (input, name) => {
			// @ts-expect-error v will be assigned
			return holder.v.get_messages(input, name)
		},
	}
	const derived_table_properties = {
		subquery: lazy,
		alias: identifier_validator,
	} as const
	const derived_table_validator = jv.object(derived_table_properties)
	const join_validator = jv.one_of(
		jv.object({ ...table_addition_properties, ...join_clause_properties }),
		jv.object({ ...derived_table_properties, ...join_clause_properties }),
	)
	holder.v = jv.object({
		select: jv.array(jv.one_of(select_expression_validator, select_grouping_validator)),
		from: jv.one_of(table_addition_validator, derived_table_validator),
		joins: jv.array(join_validator),
		where: jv.nullable(where_grouping_validator),
		group_by: jv.array(select_expression_validator),
		order_by: jv.array(order_by_validator),
		limit: limit_validator,
		having: jv.nullable(having_grouping_validator),
		for_update: jv.optional(jv.is_boolean),
	}) as unknown as Validator<SafeSelectQuery>
	return holder.v
}

export const safe_select_query_validator = make_safe_select_query_validator()

export type ColumnReference = InferValidator<typeof column_reference_validator>
export type UserProvidedValue = InferValidator<typeof user_provided_value_validator>
export type Comparator = InferValidator<typeof comparator_validator>
export type Comparison = InferValidator<typeof comparison_validator>
export type FunctionName = InferValidator<typeof function_name_validator>
export type FunctionExpression = InferValidator<typeof function_expression_validator>
export type SelectExpression = InferValidator<typeof select_expression_validator>
export type TableAddition = InferValidator<typeof table_addition_validator>
export type AliasReference = InferValidator<typeof alias_reference_validator>
export type OrderByDirection = InferValidator<typeof order_by_direction_validator>
export type OrderByExpression = InferValidator<typeof order_by_expression_validator>
export type OrderBy = InferValidator<typeof order_by_validator>
export type HavingComparison = {
	type: 'comparison'
	left: AliasReference | UserProvidedValue
	comparator: Comparator
	right: AliasReference | UserProvidedValue
}
export type HavingGrouping = AndOrGrouping<HavingComparison>
export type Join = TableSource & {
	on_clause: Array<Comparison | FunctionExpression | WhereGrouping>
	left?: boolean | undefined
}
export type SelectGrouping = {
	type: 'and' | 'or'
	expressions: Array<SelectExpression | SelectGrouping>
	alias?: string
}
export type WhereGrouping = AndOrGrouping<Comparison>
export type DerivedTable = {
	subquery: SafeSelectQuery
	alias: string
}
export type TableSource = TableAddition | DerivedTable
export type SafeSelectQuery = {
	select: Array<SelectExpression | SelectGrouping>
	from: TableSource
	joins: Array<Join>
	where: WhereGrouping | null
	group_by: Array<SelectExpression>
	order_by: Array<OrderBy>
	limit: bigint | null
	having: HavingGrouping | null
	for_update?: boolean
}
