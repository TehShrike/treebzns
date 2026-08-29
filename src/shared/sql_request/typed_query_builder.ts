import type { FinancialNumber } from 'financial-number'
import { for_each, map } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import { omit } from '#shared/omit.ts'
import type {
	Comparator,
	SafeSelectQuery,
	Comparison,
	ColumnReference,
	UserProvidedValue,
	FunctionExpression,
	FunctionName,
	Join as TrustableJoin,
	AliasReference,
	OrderBy,
	OrderByDirection,
	OrderByExpression,
	HavingComparison,
	HavingGrouping,
	SelectExpression,
	SelectGrouping,
	WhereGrouping,
} from "./safe_select_query_validator.ts"

type SchemaColumnTypes = {
	[table_name in string]: {
		[column_name in string]: any
	}
}

type AliasMap<Schema extends SchemaColumnTypes> = {
	[alias: string]: Extract<keyof Schema, string>
}

type ColumnRef<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>> = {
	[Alias in keyof A & string]: `${Alias}.${Extract<keyof Schema[A[Alias]], string>}`
}[keyof A & string]

type ValueRef = { value: unknown }

type Expression = { __expression: true }

type ExpressionBuilder<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>> = {
	comparison: (
		left: ColumnRef<Schema, A> | ValueRef | FunctionExpression,
		comparator: Comparator,
		right: ColumnRef<Schema, A> | ValueRef | FunctionExpression,
	) => Expression
	and: (...exprs: Expression[]) => Expression
	or: (...exprs: Expression[]) => Expression
	fn: (name: FunctionName, ...args: (ColumnRef<Schema, A> | ValueRef)[]) => FunctionExpression
}

// HAVING filters on the aggregated result, so its comparison operands are select identifiers (`Ids`)
// or values — never raw table columns.
type HavingExpressionBuilder<Ids extends string> = {
	comparison: (left: Ids | ValueRef, comparator: Comparator, right: Ids | ValueRef) => Expression
	and: (...exprs: Expression[]) => Expression
	or: (...exprs: Expression[]) => Expression
}

type SelectColumnInput<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>> =
	ColumnRef<Schema, A> | `${ColumnRef<Schema, A>} AS ${string}`

type FunctionReturnType<Fn extends FunctionName> =
	Fn extends 'COUNT' | 'COUNT DISTINCT' ? bigint
	: Fn extends 'IS NULL' | 'IS NOT NULL' ? boolean
	: unknown

type ColumnTypeOf<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>, CR> =
	CR extends `${infer T}.${infer C}`
		? T extends keyof A
			? C extends keyof Schema[A[T] & keyof Schema]
				? Schema[A[T] & keyof Schema][C]
				: never
			: never
		: never

// The claimed return types are assertions about the connection's typeCast, like the ones in
// mysql_function.ts. MAX/MIN return the column's own MySQL type. SUM/AVG return NEWDECIMAL,
// which typeCast maps to FinancialNumber. All aggregates return NULL when no rows match.
type FunctionReturnTypeWithArg<Fn extends FunctionName, Arg> =
	Fn extends 'MAX' | 'MIN' ? Arg | null
	: Fn extends 'SUM' | 'AVG' ? FinancialNumber | null
	: FunctionReturnType<Fn>

type FunctionReturnTypeWithTwoArgs<Fn extends FunctionName, Arg1, Arg2> =
	Fn extends 'IFNULL' ? Exclude<Arg1, null> | Arg2
	: FunctionReturnType<Fn>

declare const function_return_type: unique symbol

// function_return_type is a phantom key recording the TS type the function produces in the row,
// so RowEntry can recover it without re-deriving it from the function name and arguments.
export type SelectableFunctionExpression<
	Table extends string = string,
	Alias extends string = string,
	Fn extends FunctionName = FunctionName,
	Return = unknown,
> = FunctionExpression & {
	function: Fn
	table_identifier: Table
	alias: Alias
	readonly [function_return_type]?: Return
}

type BeforeDot<S> = S extends `${infer T extends string}.${string}` ? T : never
type AfterDot<S> = S extends `${string}.${infer A extends string}` ? A : never

type SelectFnAlias<A extends AliasMap<any>> = `${keyof A & string}.${string}`

type SelectGroupingItem<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>> =
	SelectColumnInput<Schema, A> | SelectGrouping

type SelectExpressionBuilder<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>> = {
	fn: {
		<const Fn extends FunctionName, const Alias extends SelectFnAlias<A>>(
			name: Fn,
			alias: Alias,
		): SelectableFunctionExpression<BeforeDot<Alias>, AfterDot<Alias>, Fn, FunctionReturnType<Fn>>
		<const Fn extends FunctionName, const Alias extends SelectFnAlias<A>, const CR extends ColumnRef<Schema, A>>(
			name: Fn,
			alias: Alias,
			arg: CR,
		): SelectableFunctionExpression<BeforeDot<Alias>, AfterDot<Alias>, Fn, FunctionReturnTypeWithArg<Fn, ColumnTypeOf<Schema, A, CR>>>
		<const Fn extends FunctionName, const Alias extends SelectFnAlias<A>, const CR1 extends ColumnRef<Schema, A>, const CR2 extends ColumnRef<Schema, A>>(
			name: Fn,
			alias: Alias,
			arg1: CR1,
			arg2: CR2,
		): SelectableFunctionExpression<BeforeDot<Alias>, AfterDot<Alias>, Fn, FunctionReturnTypeWithTwoArgs<Fn, ColumnTypeOf<Schema, A, CR1>, ColumnTypeOf<Schema, A, CR2>>>
		<const Fn extends FunctionName, const Alias extends SelectFnAlias<A>, const CR1 extends ColumnRef<Schema, A>, const V>(
			name: Fn,
			alias: Alias,
			arg1: CR1,
			arg2: { value: V },
		): SelectableFunctionExpression<BeforeDot<Alias>, AfterDot<Alias>, Fn, FunctionReturnTypeWithTwoArgs<Fn, ColumnTypeOf<Schema, A, CR1>, V>>
	}
	and: <const Alias extends SelectFnAlias<A>>(alias: Alias, ...items: SelectGroupingItem<Schema, A>[]) => SelectGrouping
	or: <const Alias extends SelectFnAlias<A>>(alias: Alias, ...items: SelectGroupingItem<Schema, A>[]) => SelectGrouping
}

type SelectInput<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>> =
	| SelectColumnInput<Schema, A>
	| SelectableFunctionExpression
	| SelectGrouping

type RowEntry<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>, Expr> =
	Expr extends { type: 'function'; table_identifier: infer T extends string; alias: infer K extends string; readonly [function_return_type]?: infer R }
		? T extends keyof A
			? { [_ in T]: { [_ in K]: R } }
			: never
		: Expr extends `${infer T}.${infer C} AS ${infer K}`
			? T extends keyof A
				? C extends keyof Schema[A[T] & keyof Schema]
					? { [_ in T]: { [_ in K]: Schema[A[T] & keyof Schema][C] } }
					: never
				: never
			: Expr extends `${infer T}.${infer C}`
				? T extends keyof A
					? C extends keyof Schema[A[T] & keyof Schema]
						? { [_ in T]: { [_ in C]: Schema[A[T] & keyof Schema][C] } }
						: never
					: never
				: never

type UnionToIntersection<U> =
	(U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never

type RowFromSelectExprs<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>, Exprs extends ReadonlyArray<unknown>> =
	UnionToIntersection<{ [I in keyof Exprs]: RowEntry<Schema, A, Exprs[I]> }[number]>

// Each selected column contributes a `{ table: { column: type } }` entry, and they get intersected
// into `{ table: { a } } & { table: { b } } & ...`. Re-mapping both levels collapses those `&`s into
// a single `{ table: { a; b; ... } }` object. Indexed access (`Row[Table][Column]`) is used on the
// inner level so column value types (bigint, Temporal.Instant, ...) are preserved, not expanded.
// A left-joined table either matched (every column keeps its schema type) or matched nothing (the
// runtime fills every selected column with null), so its object is a union of those two shapes
// rather than `| null` on each column — that keeps schema nullability recoverable after a
// null-key check proves the join matched (see group_joined_rows.ts).
type FlattenRow<Row, LeftJoined extends string = never> = {
	[Table in keyof Row]: Table extends LeftJoined
		? { [Column in keyof Row[Table]]: Row[Table][Column] } | { [Column in keyof Row[Table]]: null }
		: { [Column in keyof Row[Table]]: Row[Table][Column] }
}

export type ResponseColumn = {
	table_identifier: string
	name: string
}

export type BuiltQuery<Row> = {
	query: SafeSelectQuery
	response_columns: ResponseColumn[]
	positional_row_to_named: (row: unknown[]) => Row
}

// `build()` already flattened the row, so re-mapping here would collapse a left-joined table's
// matched-or-all-null union back into `| null` on each column.
export type ExtractQueryResponse<T> = T extends BuiltQuery<infer Row>
	? Row
	: never

// Given a flattened `{ table: { identifier: type } }` row, the union of all identifiers (the inner keys).
type IdentifiersOfFlatRow<Flat> = {
	[Table in keyof Flat]: keyof Flat[Table] & string
}[keyof Flat]

// Internal: the identifiers produced by SELECT so far (column aliases, function aliases, grouping
// aliases), derived from the accumulated `Row` type. `never` until something has been selected.
type RowIdentifiers<Row> = IdentifiersOfFlatRow<FlattenRow<Row>>

// Public: the union of identifiers a built query selects — whether from a column, a column alias, a
// function alias, or a grouping alias. Namespacing-by-table is collapsed; if two tables select the
// same identifier you get it once. Use `ExtractQueryResponse` if you need to keep the table grouping.
export type SelectedIdentifiers<Q> = IdentifiersOfFlatRow<ExtractQueryResponse<Q>>

type TableAliasArg<Schema extends SchemaColumnTypes> =
	Extract<keyof Schema, string> | `${Extract<keyof Schema, string>} AS ${string}`

type ParseTableAlias<S extends string, Schema extends SchemaColumnTypes> =
	S extends `${infer T extends Extract<keyof Schema, string>} AS ${infer A}`
		? { [K in A]: T }
		: S extends Extract<keyof Schema, string>
			? { [K in S]: S }
			: never

type Joiner<
	Schema extends SchemaColumnTypes,
	A extends AliasMap<Schema>,
	LeftJoined extends string,
	Row,
	Left extends boolean,
> = <S extends TableAliasArg<Schema>>(
	table_alias: S,
	on: (b: ExpressionBuilder<Schema, A & ParseTableAlias<S, Schema>>) => Expression,
) => Stage<
	Schema,
	A & ParseTableAlias<S, Schema>,
	Left extends true ? LeftJoined | (keyof ParseTableAlias<S, Schema> & string) : LeftJoined,
	Row
>

type Stage<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>, LeftJoined extends string = never, Row = {}> = {
	join: Joiner<Schema, A, LeftJoined, Row, false>

	left_join: Joiner<Schema, A, LeftJoined, Row, true>

	where: (
		cb: (b: ExpressionBuilder<Schema, A>) => Expression,
	) => Stage<Schema, A, LeftJoined, Row>

	select: <const Exprs extends ReadonlyArray<SelectInput<Schema, A>>>(
		cb: (b: SelectExpressionBuilder<Schema, A>) => Exprs,
	) => Stage<Schema, A, LeftJoined, Row & RowFromSelectExprs<Schema, A, Exprs>>

	group_by: (...exprs: SelectColumnInput<Schema, A>[]) => Stage<Schema, A, LeftJoined, Row>

	order_by: (
		column: ColumnRef<Schema, A> | RowIdentifiers<Row> | ((b: ExpressionBuilder<Schema, A>) => FunctionExpression),
		direction?: OrderByDirection,
	) => Stage<Schema, A, LeftJoined, Row>

	having: (cb: (b: HavingExpressionBuilder<RowIdentifiers<Row>>) => Expression) => Stage<Schema, A, LeftJoined, Row>

	limit: (count: bigint) => Stage<Schema, A, LeftJoined, Row>

	build: () => BuiltQuery<FlattenRow<Row, LeftJoined>>
}

export type QueryBuilder<Schema extends SchemaColumnTypes> = {
	from: <S extends TableAliasArg<Schema>>(
		table_alias: S,
	) => Stage<Schema, ParseTableAlias<S, Schema>>
}

type ColumnOrValueInput = string | { value: unknown } | FunctionExpression

type BoolExpr = WhereGrouping | Comparison

type HavingBoolExpr = HavingGrouping | HavingComparison

type InternalSelectGrouping = SelectGrouping & { table_identifier: string; alias: string }

type State = {
	from: { table_name: string; alias: string }
	joins: TrustableJoin[]
	where_expressions: BoolExpr[]
	selects: Array<SelectExpression | InternalSelectGrouping>
	group_bys: SelectExpression[]
	order_bys: OrderBy[]
	havings: HavingBoolExpr[]
	limit: bigint | null
}

// Identifiers are interpolated straight into the SQL string (inside backticks), not parameterized,
// so the builder rejects anything outside a safe character set up front. This mirrors the assertion
// in safe_select_query_validator.ts — the validator is the security boundary on the server; this is the
// same rule enforced early for a clear error at construction time.
const assert_identifier = (s: string, role: string): string => {
	assert(/^\w+$/.test(s), `${role} must be a valid SQL identifier (letters, numbers, and underscores only): ${JSON.stringify(s)}`)
	return s
}

const parse_table_alias = (s: string): { table: string; alias: string } => {
	const m = /^(\w+)\s+AS\s+(\w+)$/i.exec(s)
	return m
		? { table: m[1]!, alias: m[2]! }
		: { table: assert_identifier(s, 'table name'), alias: assert_identifier(s, 'alias') }
}

const parse_col_ref = (s: string): { table: string; column: string } => {
	const dot = s.indexOf('.')
	return {
		table: assert_identifier(s.slice(0, dot), 'table identifier'),
		column: assert_identifier(s.slice(dot + 1), 'column'),
	}
}

const to_select_expression = (input: string | SelectableFunctionExpression): SelectExpression => {
	if (typeof input !== 'string') return input
	const m = /^(\w+)\.(\w+)(?:\s+AS\s+(\w+))?$/i.exec(input)
	if (!m) throw new Error(`invalid select column: ${input}`)
	const base = { type: 'column reference' as const, table_identifier: m[1]!, column: m[2]! }
	return m[3] !== undefined ? { ...base, alias: m[3] } : base
}

const to_column_or_value = (input: ColumnOrValueInput): ColumnReference | UserProvidedValue | FunctionExpression => {
	if (typeof input === 'object' && 'type' in input && input.type === 'function') return input
	if (typeof input === 'object' && 'value' in input) {
		return { type: 'user provided value', value: (input as { value: unknown }).value }
	}
	const { table, column } = parse_col_ref(input as string)
	return { type: 'column reference', table_identifier: table, column }
}

const expression_builder = {
	comparison: (left: ColumnOrValueInput, comparator: Comparator, right: ColumnOrValueInput): BoolExpr => ({
		type: 'comparison',
		left: to_column_or_value(left),
		comparator,
		right: to_column_or_value(right),
	}),
	and: (...exprs: BoolExpr[]): BoolExpr => ({ type: 'and', expressions: exprs }),
	or: (...exprs: BoolExpr[]): BoolExpr => ({ type: 'or', expressions: exprs }),
	fn: (name: FunctionName, ...args: ColumnOrValueInput[]): FunctionExpression => ({
		type: 'function',
		function: name,
		arguments: args.map(a => {
			const v = to_column_or_value(a)
			if (v.type === 'function') throw new Error('nested function expressions are not supported')
			return v
		}),
	}),
}

const to_alias_or_value = (input: string | { value: unknown }): AliasReference | UserProvidedValue =>
	typeof input === 'object'
		? { type: 'user provided value', value: input.value }
		// Alias references are typed as the finite union of selected aliases (RowIdentifiers), so the
		// type system already constrains them; the validator is the authoritative runtime guard.
		: { type: 'alias reference', alias: input }

type AliasOrValueInput = string | { value: unknown }

const having_expression_builder = {
	comparison: (left: AliasOrValueInput, comparator: Comparator, right: AliasOrValueInput): HavingBoolExpr => ({
		type: 'comparison',
		left: to_alias_or_value(left),
		comparator,
		right: to_alias_or_value(right),
	}),
	and: (...exprs: HavingBoolExpr[]): HavingBoolExpr => ({ type: 'and', expressions: exprs }),
	or: (...exprs: HavingBoolExpr[]): HavingBoolExpr => ({ type: 'or', expressions: exprs }),
}

const having_bool_expr_to_grouping = (expr: HavingBoolExpr): HavingGrouping =>
	'expressions' in expr
		? expr
		: { type: 'and' as const, expressions: [expr] }

const to_select_grouping_expression = (item: string | SelectGrouping): SelectExpression | SelectGrouping =>
	typeof item === 'string' ? to_select_expression(item) : item

const select_expression_builder = {
	fn: (name: FunctionName, alias: string, ...fn_args: (string | { value: unknown })[]): SelectableFunctionExpression => {
		if (fn_args.length > 2) throw new Error('fn supports at most 2 arguments')
		const [table_identifier, col_alias, ...rest] = alias.split('.')
		assert(table_identifier && col_alias && rest.length === 0, `select fn alias must be "table.col_alias": ${alias}`)
		assert_identifier(table_identifier, 'select fn table identifier')
		assert_identifier(col_alias, 'select fn alias')
		const args = map(fn_args, arg => {
			if (typeof arg === 'object') {
				return { type: 'user provided value' as const, value: arg.value }
			}
			const { table, column } = parse_col_ref(arg)
			return { type: 'column reference' as const, table_identifier: table, column }
		})
		return { type: 'function', function: name, arguments: args, alias: col_alias, table_identifier }
	},
	and: (alias: string, ...items: (string | SelectGrouping)[]): InternalSelectGrouping => {
		const [table_identifier, col_alias, ...rest] = alias.split('.')
		assert(table_identifier && col_alias && rest.length === 0, `select grouping alias must be "table.col_alias": ${alias}`)
		assert_identifier(table_identifier, 'select grouping table identifier')
		assert_identifier(col_alias, 'select grouping alias')
		return { type: 'and', expressions: items.map(to_select_grouping_expression), table_identifier, alias: col_alias }
	},
	or: (alias: string, ...items: (string | SelectGrouping)[]): InternalSelectGrouping => {
		const [table_identifier, col_alias, ...rest] = alias.split('.')
		assert(table_identifier && col_alias && rest.length === 0, `select grouping alias must be "table.col_alias": ${alias}`)
		assert_identifier(table_identifier, 'select grouping table identifier')
		assert_identifier(col_alias, 'select grouping alias')
		return { type: 'or', expressions: items.map(to_select_grouping_expression), table_identifier, alias: col_alias }
	},
}

const bool_expr_to_where_grouping = (expr: BoolExpr): WhereGrouping =>
	'expressions' in expr
		? expr
		: { type: 'and' as const, expressions: [expr] }

const joiner = ({ left, state }: { left: boolean, state: State }) => (table_alias: string, on: (b: typeof expression_builder) => BoolExpr) => {
	const { table, alias } = parse_table_alias(table_alias)
	const expr = on(expression_builder)
	return make_stage({
		...state,
		joins: [...state.joins, { table_name: table, alias, on_clause: [expr], left }],
	})
}

const make_stage = (state: State): any => ({
	join: joiner({ left: false, state }),
	left_join: joiner({ left: true, state }),
	where: (cb: (b: typeof expression_builder) => BoolExpr) => {
		return make_stage({ ...state, where_expressions: [...state.where_expressions, cb(expression_builder)] })
	},
	select: (cb: (b: typeof select_expression_builder) => ReadonlyArray<string | SelectableFunctionExpression | SelectGrouping>) => {
		const items = cb(select_expression_builder)
		const new_selects = map(items, (item): SelectExpression | InternalSelectGrouping => {
			if (typeof item === 'string') return to_select_expression(item)
			if (item.type === 'and' || item.type === 'or') return item as InternalSelectGrouping
			assert(item.type === 'function', `expected function expression in select, got "${item.type}"`)
			return to_select_expression(item)
		})
		return make_stage({ ...state, selects: [...state.selects, ...new_selects] })
	},
	group_by: (...exprs: string[]) => {
		return make_stage({ ...state, group_bys: [...state.group_bys, ...map(exprs, to_select_expression)] })
	},
	order_by: (column: string | ((b: typeof expression_builder) => FunctionExpression), direction: OrderByDirection = 'ASC') => {
		let expression: OrderByExpression
		if (typeof column === 'function') {
			expression = column(expression_builder)
		} else if (column.includes('.')) {
			const { table, column: column_name } = parse_col_ref(column)
			expression = { type: 'column reference', table_identifier: table, column: column_name }
		} else {
			expression = { type: 'alias reference', alias: column }
		}
		const order: OrderBy = { expression, direction }
		return make_stage({ ...state, order_bys: [...state.order_bys, order] })
	},
	having: (cb: (b: typeof having_expression_builder) => HavingBoolExpr) => {
		return make_stage({ ...state, havings: [...state.havings, cb(having_expression_builder)] })
	},
	limit: (count: bigint) => {
		return make_stage({ ...state, limit: count })
	},
	build: (): BuiltQuery<unknown> => {
		const response_columns: ResponseColumn[] = map(state.selects, s => {
			if ('expressions' in s) {
				return { table_identifier: s.table_identifier, name: s.alias }
			}

			const name = s.type === 'column reference' ? (s.alias ?? s.column) : s.alias
			return { table_identifier: s.table_identifier, name }
		})
		return {
			query: {
				select: map(state.selects, (s): SelectExpression | SelectGrouping => {
					if ('expressions' in s) {
						return omit(s, ['table_identifier'])
					}

					return s
				}),
				from: state.from,
				joins: state.joins,
				where: state.where_expressions.length === 0
					? null
					: state.where_expressions.length === 1
						? bool_expr_to_where_grouping(state.where_expressions[0]!)
						: { type: 'and' as const, expressions: state.where_expressions },
				group_by: state.group_bys,
				order_by: state.order_bys,
				limit: state.limit,
				having: state.havings.length === 0
					? null
					: state.havings.length === 1
						? having_bool_expr_to_grouping(state.havings[0]!)
						: { type: 'and' as const, expressions: state.havings },
			},
			response_columns,
			positional_row_to_named: (row: unknown[]): Record<string, Record<string, unknown>> => {
				const results: Record<string, Record<string, unknown>> = {}

				for_each(response_columns, (response_column, index) => {
					results[response_column.table_identifier] = {
						...results[response_column.table_identifier],
						[response_column.name]: row[index],
					}
				})

				return results
			}
		}
	},
})

const query_builder = <Schema extends SchemaColumnTypes>(): QueryBuilder<Schema> => ({
	from: ((table_alias: string) => {
		const { table, alias } = parse_table_alias(table_alias)
		return make_stage({
			from: { table_name: table, alias },
			joins: [],
			where_expressions: [],
			selects: [],
			group_bys: [],
			order_bys: [],
			havings: [],
			limit: null,
		})
	}) as any,
})

export default query_builder
