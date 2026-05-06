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
			sql: `\`${value.table_identifier}\`.\`${value.column}\``,
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

type FunctionArgument = ColumnReference | UserProvidedValue
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

function assertOneOrTwoArguments<T>(args: T[]): asserts args is [T] | [T, T] {
	if (args.length !== 1 && args.length !== 2) {
		throw new Error('Must have 1 or 2 arguments')
	}
}

type SchemaColumns = {
	[table_name in string]: {
		[column_name in string]: column_name
	}
}

type QueryValidationResult = {
	valid: true
} | {
	valid: false
	messages: string[]
}

const comparison_to_chunk = (comp: Comparison): SqlChunk => {
	const left = value_to_sql_chunk(comp.left)
	const right = value_to_sql_chunk(comp.right)
	return {
		sql: `${left.sql} ${comp.comparator} ${right.sql}`,
		parameters: [...left.parameters, ...right.parameters],
	}
}

const on_clause_item_to_chunk = (clause: Comparison | FunctionExpression): SqlChunk => {
	if (clause.type === 'comparison') return comparison_to_chunk(clause)
	assert(clause.function in FUNCTIONS)
	assertOneOrTwoArguments(clause.arguments)
	return FUNCTIONS[clause.function](clause.arguments)
}

const select_item_to_chunk = (sel: SelectExpression): SqlChunk => {
	if (sel.type === 'column reference') {
		const chunk = value_to_sql_chunk(sel)
		return sel.alias ? { ...chunk, sql: `${chunk.sql} AS \`${sel.alias}\`` } : chunk
	}
	assert(sel.function in FUNCTIONS)
	assertOneOrTwoArguments(sel.arguments)
	const chunk = FUNCTIONS[sel.function](sel.arguments)
	return { ...chunk, sql: `${chunk.sql} AS \`${sel.alias}\`` }
}

const merge_chunks = (chunks: SqlChunk[], separator: string): SqlChunk => ({
	sql: chunks.map(c => c.sql).join(separator),
	parameters: chunks.flatMap(c => c.parameters),
})

export const make_query_validator = <ThisSchema extends SchemaColumns>(schema: ThisSchema) => {
	const validate = (query: TrustableSelectQuery): QueryValidationResult => {
		const messages: string[] = []
		const invalid_tables = new Set<string>()

		const check_table = (name: string) => {
			if (!schema[name] && !invalid_tables.has(name)) {
				messages.push(`Unknown table: ${name}`)
				invalid_tables.add(name)
			}
		}

		const check_col_ref = (ref: ColumnReference) => {
			if (invalid_tables.has(ref.table_identifier)) return
			const table = schema[ref.table_identifier]
			if (!table) {
				messages.push(`Unknown table: ${ref.table_identifier}`)
				invalid_tables.add(ref.table_identifier)
				return
			}
			if (!(ref.column in table)) {
				messages.push(`Unknown column '${ref.column}' on table '${ref.table_identifier}'`)
			}
		}

		const check_arg = (arg: ColumnReference | UserProvidedValue) => {
			if (arg.type === 'column reference') check_col_ref(arg)
		}

		check_table(query.from.table_name)
		for (const join of query.joins) check_table(join.table_name)

		for (const sel of query.select) {
			if (sel.type === 'column reference') check_col_ref(sel)
			else for (const arg of sel.arguments) check_arg(arg)
		}

		for (const join of query.joins) {
			for (const clause of join.on_clause) {
				if (clause.type === 'comparison') {
					check_arg(clause.left)
					check_arg(clause.right)
				} else {
					for (const arg of clause.arguments) check_arg(arg)
				}
			}
		}

		for (const comp of query.where) {
			check_arg(comp.left)
			check_arg(comp.right)
		}

		if (messages.length > 0) return { valid: false, messages }
		return { valid: true }
	}

	const to_sql = (query: TrustableSelectQuery): { sql: string, parameters: any[] } => {
		const select_chunk = merge_chunks(query.select.map(select_item_to_chunk), ', ')

		const join_chunks = query.joins.map(join => {
			const on = merge_chunks(join.on_clause.map(on_clause_item_to_chunk), '\n\tAND ')
			return {
				sql: `JOIN \`${join.table_name}\` AS \`${join.alias}\` ON ${on.sql}`,
				parameters: on.parameters,
			} satisfies SqlChunk
		})

		const where_chunk = query.where.length > 0
			? merge_chunks(query.where.map(comparison_to_chunk), '\n\tAND ')
			: null

		const all_params = [
			...select_chunk.parameters,
			...join_chunks.flatMap(c => c.parameters),
			...(where_chunk?.parameters ?? []),
		]

		return {
			sql: [
				`SELECT ${select_chunk.sql}`,
				`FROM \`${query.from.table_name}\` AS \`${query.from.alias}\``,
				...join_chunks.map(c => c.sql),
				...(where_chunk ? [`WHERE ${where_chunk.sql}`] : []),
			].join('\n'),
			parameters: all_params.map(p => p.value),
		}
	}

	return { validate, to_sql }
}
