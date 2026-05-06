import * as jv from '#shared/json_validator.ts'
import type { InferValidator, Validator } from '#shared/json_validator.ts'

const any_validator = jv.custom<any>({ is_valid: (_): _ is any => true, get_messages: () => [] })

const column_reference_object_properties = {
	type: jv.exact('column reference' as const),
	table_identifier: jv.is_string,
	column: jv.is_string,
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

export const comparison_validator = jv.object({
	type: jv.exact('comparison' as const),
	left: jv.one_of(column_reference_validator, user_provided_value_validator),
	comparator: comparator_validator,
	right: jv.one_of(column_reference_validator, user_provided_value_validator),
})

export const function_name_validator = jv.one_of(
	jv.exact('IS NOT NULL' as const),
	jv.exact('IS NULL' as const),
	jv.exact('COUNT' as const),
	jv.exact('COUNT DISTINCT' as const),
)

const function_argument_validator = jv.one_of(column_reference_validator, user_provided_value_validator)

export const function_expression_validator = jv.object({
	type: jv.exact('function' as const),
	function: function_name_validator,
	arguments: jv.array(function_argument_validator),
})

const column_reference_select_validator = jv.object({
	...column_reference_object_properties,
	alias: jv.optional(jv.is_string),
// defined manually because jv.optional produces `string | undefined`
}) as Validator<ColumnReference & { alias?: string }>

const function_expression_select_validator = jv.object({
	type: jv.exact('function' as const),
	function: function_name_validator,
	arguments: jv.array(function_argument_validator),
	alias: jv.is_string,
})

export const select_expression_validator = jv.one_of(
	column_reference_select_validator,
	function_expression_select_validator,
)

export const table_addition_validator = jv.object({
	table_name: jv.is_string,
	alias: jv.is_string,
})

export const join_validator = jv.object({
	table_name: jv.is_string,
	alias: jv.is_string,
	on_clause: jv.array(jv.one_of(comparison_validator, function_expression_validator)),
})

export const trustable_select_query_validator = jv.object({
	select: jv.array(select_expression_validator),
	from: table_addition_validator,
	joins: jv.array(join_validator),
	where: jv.array(comparison_validator),
	group_by: jv.array(select_expression_validator),
})

export type ColumnReference = InferValidator<typeof column_reference_validator>
export type UserProvidedValue = InferValidator<typeof user_provided_value_validator>
export type Comparator = InferValidator<typeof comparator_validator>
export type Comparison = InferValidator<typeof comparison_validator>
export type FunctionName = InferValidator<typeof function_name_validator>
export type FunctionExpression = InferValidator<typeof function_expression_validator>
export type SelectExpression = InferValidator<typeof select_expression_validator>
export type TableAddition = InferValidator<typeof table_addition_validator>
export type Join = InferValidator<typeof join_validator>
export type TrustableSelectQuery = {
	select: Array<SelectExpression>
	from: TableAddition
	joins: Array<Join>
	where: Array<Comparison>
	group_by: Array<SelectExpression>
}
