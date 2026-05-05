import { assert } from '#shared/assert.ts'

type ColumnReference = {
	type: 'column reference'
	table_identifier: string
	column: string
}

type SelectExpression = (ColumnReference & {
	alias?: string
}) | FunctionExpression & {
	alias: string
}

type TableAddition = {
	table_name: string
	alias: string
}

type Comparator = '>' | '>=' | '<' | '!=' | '<=' | '<=>' | '='

type UserProvidedValue = {
	type: 'user provided value'
	value: any
}

type Comparison = {
	type: 'comparison'
	left: ColumnReference | UserProvidedValue
	comparator: Comparator
	right: ColumnReference | UserProvidedValue
}

type SqlChunk = {
	sql: string
	parameters: Array<UserProvidedValue>
}

const value_to_sql_chunk = (value: SomeFunctionArgument) => {
	if (value.type === 'column reference') {
		return {
			sql: `${value.table_identifier}.${value.column}`,
			parameters: [],
		}
	} else {
		return {
			sql: `?`,
			parameters: [value],
		}
	}
}

type SomeFunctionArgument = UserProvidedValue | ColumnReference
type SomeFunctionArguments = [SomeFunctionArgument, SomeFunctionArgument] | [SomeFunctionArgument]
const to_sql_chunk = (builder: {
	build_sql_1?: (value: string) => string,
	build_sql_2?: (value_a: string, value_b: string) => string,
}, values: SomeFunctionArguments) => {
	if (values.length === 1) {
		assert('build_sql_1' in builder, 'build_sql_1 is required')

		const { sql, parameters } = value_to_sql_chunk(values[0])

		return {
			sql: builder.build_sql_1(sql),
			parameters,
		}
	} else {
		assert('build_sql_2' in builder, 'build_sql_2 is required')

		const { sql: sql_a, parameters: parameters_a } = value_to_sql_chunk(values[0])
		const { sql: sql_b, parameters: parameters_b } = value_to_sql_chunk(values[1])

		return {
			sql: builder.build_sql_2(sql_a, sql_b),
			parameters: [...parameters_a, ...parameters_b],
		}
	}
}

type FunctionArgument = ColumnReference// | UserProvidedValue
const FUNCTIONS = {
	'IS NOT NULL': (args: SomeFunctionArguments) => to_sql_chunk({
		build_sql_1: (value: string) => `${value} IS NOT NULL`
	}, args),
	'IS NULL': (args: SomeFunctionArguments) => to_sql_chunk({
		build_sql_1: (value: string) => `${value} IS NULL`
	}, args),
	'COUNT': (args: SomeFunctionArguments) => to_sql_chunk({
		build_sql_1: (value: string) => `COUNT(${value})`
	}, args),
	'COUNT DISTINCT': (args: SomeFunctionArguments) => to_sql_chunk({
		build_sql_1: (value: string) => `COUNT(DISTINCT ${value})`
	}, args),
} as const satisfies { [key in string]: (args: SomeFunctionArguments) => SqlChunk }

type FunctionName = keyof typeof FUNCTIONS

type FunctionExpression = {
	type: 'function'
	function: FunctionName
	arguments: Array<ColumnReference | UserProvidedValue>
}

type Join = TableAddition & {
	on_clause: Array<Comparison | FunctionExpression>
}

export type TrustableSelectQuery = {
	select: Array<SelectExpression>
	from: TableAddition
	joins: Array<Join>
	where: Array<Comparison>
}

type SchemaColumns = {
	[table_name in string]: {
		[column_name in string]: column_name
	}
}

type QueryValidationResult = {
	valid: true
	sql: string
	parameters: Array<UserProvidedValue>
} | {
	valid: false
	messages: string[]
}
export const make_query_validator = <ThisSchema extends SchemaColumns>(schema: ThisSchema) => {
	return (query: TrustableSelectQuery): QueryValidationResult => {
		return {
			valid: true,
			sql: '',
			parameters: [],
		}
	}
}
