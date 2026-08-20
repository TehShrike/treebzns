import assert from '#shared/assert.ts'
import { for_each, map } from '#shared/array.ts'
import type {
	ColumnReference,
	UserProvidedValue,
	Comparator,
	Comparison,
	FunctionName,
	FunctionExpression,
	AliasReference,
	SelectExpression,
	SelectGrouping,
	WhereGrouping,
	OrderBy,
	AndOrGrouping,
	SafeSelectQuery,
} from './safe_select_query_validator.ts'

type ComparisonOperand = ColumnReference | UserProvidedValue | FunctionExpression | AliasReference

// A comparison whose operands may be any renderable operand — covers both WHERE (columns/values/functions)
// and HAVING (aliases/values). Used so one set of renderers handles both clauses.
type RenderableComparison = { type: 'comparison'; left: ComparisonOperand; comparator: Comparator; right: ComparisonOperand }
type RenderableGrouping = AndOrGrouping<RenderableComparison>

export type { SafeSelectQuery }

type SqlChunk = {
	sql: string
	parameters: Array<UserProvidedValue>
}

const value_to_sql_chunk = (value: ColumnReference | UserProvidedValue) => {
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

type SomeFunctionArguments = [ColumnReference | UserProvidedValue, ColumnReference | UserProvidedValue] | [ColumnReference | UserProvidedValue] | []
const to_sql_chunk = (builder: {
	build_sql_0?: () => string,
	build_sql_1?: (value: string) => string,
	build_sql_2?: (value_a: string, value_b: string) => string,
}, values: SomeFunctionArguments) => {
	if (values.length === 0) {
		assert('build_sql_0' in builder, 'build_sql_0 is required')
		return {
			sql: builder.build_sql_0(),
			parameters: [],
		}
	}
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

const FUNCTIONS = {
	'IS NOT NULL': (args: SomeFunctionArguments) => to_sql_chunk({
		build_sql_1: (value: string) => `${value} IS NOT NULL`
	}, args),
	'IS NULL': (args: SomeFunctionArguments) => to_sql_chunk({
		build_sql_1: (value: string) => `${value} IS NULL`
	}, args),
	'COUNT': (args: SomeFunctionArguments) => to_sql_chunk({
		build_sql_0: () => `COUNT(*)`,
		build_sql_1: (value: string) => `COUNT(${value})`
	}, args),
	'COUNT DISTINCT': (args: SomeFunctionArguments) => to_sql_chunk({
		build_sql_1: (value: string) => `COUNT(DISTINCT ${value})`
	}, args),
	'UUID_TO_BIN': (args: SomeFunctionArguments) => to_sql_chunk({
		build_sql_1: (value: string) => `UUID_TO_BIN(${value})`
	}, args),
} as const satisfies { [key in FunctionName]: (args: SomeFunctionArguments) => SqlChunk }

const operand_to_sql_chunk = (operand: ComparisonOperand): SqlChunk => {
	if (operand.type === 'alias reference') {
		return { sql: `\`${operand.alias}\``, parameters: [] }
	}
	if (operand.type === 'function') {
		assert(operand.function in FUNCTIONS)
		assertZeroOrOneOrTwoArguments(operand.arguments)
		return FUNCTIONS[operand.function](operand.arguments)
	}
	return value_to_sql_chunk(operand)
}

function assertZeroOrOneOrTwoArguments<T>(args: T[]): asserts args is [] | [T] | [T, T] {
	if (args.length !== 0 && args.length !== 1 && args.length !== 2) {
		throw new Error('Must have 0, 1, or 2 arguments')
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

const comparison_to_chunk = (comp: RenderableComparison): SqlChunk => {
	const left = operand_to_sql_chunk(comp.left)
	const right = operand_to_sql_chunk(comp.right)
	return {
		sql: `${left.sql} ${comp.comparator} ${right.sql}`,
		parameters: [...left.parameters, ...right.parameters],
	}
}

const on_clause_item_to_chunk = (clause: Comparison | FunctionExpression | WhereGrouping): SqlChunk => {
	if ('expressions' in clause) return bool_expr_to_chunk(clause)
	if (clause.type === 'comparison') return comparison_to_chunk(clause)
	assert(clause.function in FUNCTIONS)
	assertZeroOrOneOrTwoArguments(clause.arguments)
	return FUNCTIONS[clause.function](clause.arguments)
}

const select_item_to_chunk = (sel: SelectExpression): SqlChunk => {
	if (sel.type === 'column reference') {
		const chunk = value_to_sql_chunk(sel)
		return sel.alias ? { ...chunk, sql: `${chunk.sql} AS \`${sel.alias}\`` } : chunk
	}
	assert(sel.function in FUNCTIONS)
	assertZeroOrOneOrTwoArguments(sel.arguments)
	const chunk = FUNCTIONS[sel.function](sel.arguments)
	return { ...chunk, sql: `${chunk.sql} AS \`${sel.alias}\`` }
}

const group_by_item_to_chunk = (sel: SelectExpression): SqlChunk => {
	if (sel.type === 'column reference') return value_to_sql_chunk(sel)
	assert(sel.function in FUNCTIONS)
	assertZeroOrOneOrTwoArguments(sel.arguments)
	return FUNCTIONS[sel.function](sel.arguments)
}

const order_by_item_to_chunk = (order: OrderBy): SqlChunk => {
	const { sql, parameters } = operand_to_sql_chunk(order.expression)
	return { sql: `${sql} ${order.direction}`, parameters }
}

const merge_chunks = (chunks: SqlChunk[], separator: string): SqlChunk => ({
	sql: map(chunks, c => c.sql).join(separator),
	parameters: chunks.map(c => c.parameters).flat(1),
})

type SelectItem = SelectExpression | SelectGrouping

// Renders a boolean expression (comparison or nested grouping) with parentheses around nested groups.
// Shared by WHERE, HAVING, and join ON clauses since they're structurally identical.
const bool_expr_to_chunk = (expr: RenderableComparison | RenderableGrouping): SqlChunk => {
	if ('expressions' in expr) {
		const chunks = map(expr.expressions, bool_expr_to_chunk)
		const sep = expr.type === 'and' ? ' AND ' : ' OR '
		const inner = merge_chunks(chunks, sep)
		return { sql: `(${inner.sql})`, parameters: inner.parameters }
	}
	return comparison_to_chunk(expr)
}

// Renders a top-level grouping without outer parentheses
const grouping_to_chunk = (grouping: RenderableGrouping): SqlChunk => {
	const chunks = map(grouping.expressions, bool_expr_to_chunk)
	const sep = grouping.type === 'and' ? '\n\tAND ' : '\n\tOR '
	return merge_chunks(chunks, sep)
}

// Renders a select item or grouping; groupings get parentheses and optional AS alias
const select_item_or_grouping_to_chunk = (item: SelectItem): SqlChunk => {
	if ('expressions' in item) {
		const chunks = map(item.expressions, select_item_or_grouping_to_chunk)
		const sep = item.type === 'and' ? ' AND ' : ' OR '
		const inner = merge_chunks(chunks, sep)
		const sql = item.alias ? `(${inner.sql}) AS \`${item.alias}\`` : `(${inner.sql})`
		return { sql, parameters: inner.parameters }
	}
	return select_item_to_chunk(item)
}

// A column whitelist restricts which columns may be referenced through this builder's validation.
// Semantics: if a table appears as a key, ONLY the listed columns may be referenced for that table;
// every other column of that table is rejected. A table absent from the whitelist is unrestricted
// (all of its columns remain referenceable). This is the access-control gate for untrusted queries —
// only validate_table_and_column_names consults it, so trusted internal callers that go straight to
// to_sql are unaffected.
type ColumnWhitelist<ThisSchema extends SchemaColumns> = {
	readonly [Table in keyof ThisSchema]?: ReadonlyArray<keyof ThisSchema[Table] & string>
}

export const make_safe_select_query_builder = <ThisSchema extends SchemaColumns>(
	schema: ThisSchema,
	column_whitelist: ColumnWhitelist<ThisSchema> = {},
) => {
	const whitelisted_columns_by_table = new Map<string, ReadonlySet<string>>(
		map(
			Object.entries(column_whitelist) as Array<[string, ReadonlyArray<string>]>,
			([table_name, columns]) => [table_name, new Set(columns)],
		),
	)

	const validate_table_and_column_names = (query: SafeSelectQuery): QueryValidationResult => {
		const messages: string[] = []
		const alias_to_table_name = new Map<string, string>()

		const register_table = (table_name: string, alias: string) => {
			if (table_name in schema) {
				alias_to_table_name.set(alias, table_name)
			} else {
				messages.push(`Unknown table: "${table_name}"`)
			}
		}

		register_table(query.from.table_name, query.from.alias)
		for_each(query.joins, join => register_table(join.table_name, join.alias))

		// The output identifiers the SELECT clause produces — the only names an ORDER BY / HAVING
		// alias reference is allowed to name.
		const select_aliases = new Set<string>()
		for_each(query.select, item => {
			if ('expressions' in item) {
				if (item.alias !== undefined) select_aliases.add(item.alias)
			} else if (item.type === 'column reference') {
				select_aliases.add(item.alias ?? item.column)
			} else {
				select_aliases.add(item.alias)
			}
		})

		const check_col_ref = (ref: ColumnReference) => {
			if (alias_to_table_name.has(ref.table_identifier)) {
				const table_name = alias_to_table_name.get(ref.table_identifier)
				assert(typeof table_name === 'string')
				assert(table_name in schema)
				const table_columns = schema[table_name]
				assert(table_columns)
				if (!(ref.column in table_columns)) {
					messages.push(`Unknown column "${ref.column}" on table identifier "${ref.table_identifier}"`)
				} else {
					const whitelisted_columns = whitelisted_columns_by_table.get(table_name)
					if (whitelisted_columns && !whitelisted_columns.has(ref.column)) {
						messages.push(`Column "${ref.column}" on table "${table_name}" is not available through this endpoint`)
					}
				}
			} else {
				messages.push(`Unknown table identifier: "${ref.table_identifier}"`)
			}
		}

		const check_alias_ref = (ref: AliasReference) => {
			if (!select_aliases.has(ref.alias)) {
				messages.push(`Unknown select alias: "${ref.alias}"`)
			}
		}

		const check_arg = (arg: ComparisonOperand) => {
			if (arg.type === 'column reference') check_col_ref(arg)
			else if (arg.type === 'function') for_each(arg.arguments, check_arg)
			else if (arg.type === 'alias reference') check_alias_ref(arg)
			// 'user provided value' needs no schema check
		}

		const check_select_expr = (expr: SelectExpression) => {
			if (expr.type === 'column reference') check_col_ref(expr)
			else {
				if (!alias_to_table_name.has(expr.table_identifier)) {
					messages.push(`Unknown table identifier: "${expr.table_identifier}"`)
				}
				for_each(expr.arguments, check_arg)
			}
		}

		const check_select_exprs = (exprs: SelectItem[]): void => {
			for_each(exprs, item => {
				if ('expressions' in item) {
					check_select_exprs(item.expressions)
				} else {
					check_select_expr(item)
				}
			})
		}

		const check_grouping = (grouping: RenderableGrouping): void => {
			for_each(grouping.expressions, expr => {
				if ('expressions' in expr) {
					check_grouping(expr)
				} else {
					check_arg(expr.left)
					check_arg(expr.right)
				}
			})
		}

		check_select_exprs(query.select)

		for_each(query.joins, join => {
			for_each(join.on_clause, clause => {
				if (clause.type === 'comparison') {
					check_arg(clause.left)
					check_arg(clause.right)
				} else if (clause.type === 'function') {
					for_each(clause.arguments, check_arg)
				} else {
					check_grouping(clause)
				}
			})
		})

		if (query.where !== null) check_grouping(query.where)

		for_each(query.group_by, check_select_expr)

		for_each(query.order_by, order => check_arg(order.expression))

		if (query.having !== null) check_grouping(query.having)

		if (messages.length > 0) return { valid: false, messages }
		return { valid: true }
	}

	const to_sql = (query: SafeSelectQuery): { sql: string, values: any[] } => {
		const select_chunk = merge_chunks(map(query.select, select_item_or_grouping_to_chunk), ', ')

		const join_chunks = map(query.joins, join => {
			const on = merge_chunks(map(join.on_clause, on_clause_item_to_chunk), '\n\tAND ')
			return {
				sql: `${join.left ? 'LEFT JOIN' : 'JOIN'} \`${join.table_name}\` AS \`${join.alias}\` ON ${on.sql}`,
				parameters: on.parameters,
			} satisfies SqlChunk
		})

		const where_chunk = query.where !== null
			? grouping_to_chunk(query.where)
			: null

		const group_by_chunk = query.group_by.length > 0
			? merge_chunks(map(query.group_by, group_by_item_to_chunk), ', ')
			: null

		const having_chunk = query.having !== null
			? grouping_to_chunk(query.having)
			: null

		const order_by_chunk = query.order_by.length > 0
			? merge_chunks(map(query.order_by, order_by_item_to_chunk), ', ')
			: null

		const all_params = [
			...select_chunk.parameters,
			...join_chunks.map(c => c.parameters).flat(1),
			...(where_chunk?.parameters ?? []),
			...(group_by_chunk?.parameters ?? []),
			...(having_chunk?.parameters ?? []),
			...(order_by_chunk?.parameters ?? []),
		]

		return {
			sql: [
				`SELECT ${select_chunk.sql}`,
				`FROM \`${query.from.table_name}\` AS \`${query.from.alias}\``,
				...map(join_chunks, c => c.sql),
				...(where_chunk ? [`WHERE ${where_chunk.sql}`] : []),
				...(group_by_chunk ? [`GROUP BY ${group_by_chunk.sql}`] : []),
				...(having_chunk ? [`HAVING ${having_chunk.sql}`] : []),
				...(order_by_chunk ? [`ORDER BY ${order_by_chunk.sql}`] : []),
				// LIMIT is a validated integer, so it's inlined rather than parameterized.
				...(query.limit !== null ? [`LIMIT ${query.limit}`] : []),
			].join('\n'),
			values: map(all_params, p => p.value),
		}
	}

	return { validate_table_and_column_names, to_sql }
}
