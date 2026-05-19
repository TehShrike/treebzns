import { map } from '#shared/array.ts'
import type {
	Comparator,
	SafeSqlQuery,
	Comparison,
	ColumnReference,
	UserProvidedValue,
	FunctionExpression,
	FunctionName,
	Join as TrustableJoin,
	SelectExpression,
} from "./safe_sql_query_validator.ts"

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
	fn: (name: FunctionName, ...args: (ColumnRef<Schema, A> | ValueRef)[]) => FunctionExpression
}

type SelectColumnInput<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>> =
	ColumnRef<Schema, A> | `${ColumnRef<Schema, A>} AS ${string}`

type RowEntry<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>, Expr> =
	Expr extends `${infer T}.${infer C} AS ${infer K}`
		? T extends keyof A
			? C extends keyof Schema[A[T] & keyof Schema]
				? { [_ in K]: Schema[A[T] & keyof Schema][C] }
				: never
			: never
		: Expr extends `${infer T}.${infer C}`
			? T extends keyof A
				? C extends keyof Schema[A[T] & keyof Schema]
					? { [_ in C]: Schema[A[T] & keyof Schema][C] }
					: never
				: never
			: never

type UnionToIntersection<U> =
	(U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never

type RowFromSelectExprs<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>, Exprs extends ReadonlyArray<unknown>> =
	UnionToIntersection<{ [I in keyof Exprs]: RowEntry<Schema, A, Exprs[I]> }[number]>

export type BuiltQuery<Row> = SafeSqlQuery & { readonly __row_type?: Row }

export type ExtractQueryResponse<T> = T extends BuiltQuery<infer Row> ? { [K in keyof Row]: Row[K] } : never

type TableAliasArg<Schema extends SchemaColumnTypes> =
	Extract<keyof Schema, string> | `${Extract<keyof Schema, string>} AS ${string}`

type ParseTableAlias<S extends string, Schema extends SchemaColumnTypes> =
	S extends `${infer T extends Extract<keyof Schema, string>} AS ${infer A}`
		? { [K in A]: T }
		: S extends Extract<keyof Schema, string>
			? { [K in S]: S }
			: never

type Stage<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>, Row = {}> = {
	join: <S extends TableAliasArg<Schema>>(
		table_alias: S,
		on: (b: ExpressionBuilder<Schema, A & ParseTableAlias<S, Schema>>) => Expression,
	) => Stage<Schema, A & ParseTableAlias<S, Schema>, Row>

	where: (
		cb: (b: ExpressionBuilder<Schema, A>) => Expression,
	) => Stage<Schema, A, Row>

	select: <const Exprs extends ReadonlyArray<SelectColumnInput<Schema, A>>>(
		...exprs: Exprs
	) => Stage<Schema, A, Row & RowFromSelectExprs<Schema, A, Exprs>>

	group_by: (...exprs: SelectColumnInput<Schema, A>[]) => Stage<Schema, A, Row>

	build: () => BuiltQuery<Row>
}

type ColumnOrValueInput = string | { value: unknown } | FunctionExpression

type RuntimeExpression =
	| { type: 'and'; children: RuntimeExpression[] }
	| Comparison

type State = {
	from: { table_name: string; alias: string }
	joins: TrustableJoin[]
	where_expressions: RuntimeExpression[]
	selects: SelectExpression[]
	group_bys: SelectExpression[]
}

const parse_table_alias = (s: string): { table: string; alias: string } => {
	const m = /^(\w+)\s+AS\s+(\w+)$/i.exec(s)
	return m ? { table: m[1]!, alias: m[2]! } : { table: s, alias: s }
}

const parse_col_ref = (s: string): { table: string; column: string } => {
	const dot = s.indexOf('.')
	return { table: s.slice(0, dot), column: s.slice(dot + 1) }
}

const to_select_expression = (input: string): SelectExpression => {
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

const flatten_expression = (expr: RuntimeExpression): Comparison[] => {
	if (expr.type === 'and') return expr.children.flatMap(flatten_expression)
	return [expr]
}

const expression_builder = {
	comparison: (left: ColumnOrValueInput, comparator: Comparator, right: ColumnOrValueInput): RuntimeExpression => ({
		type: 'comparison',
		left: to_column_or_value(left),
		comparator,
		right: to_column_or_value(right),
	}),
	and: (...children: RuntimeExpression[]): RuntimeExpression => ({ type: 'and', children }),
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

const make_stage = (state: State): any => ({
	join: (table_alias: string, on: (b: typeof expression_builder) => RuntimeExpression) => {
		const { table, alias } = parse_table_alias(table_alias)
		const expr = on(expression_builder)
		return make_stage({
			...state,
			joins: [...state.joins, { table_name: table, alias, on_clause: flatten_expression(expr) }],
		})
	},
	where: (cb: (b: typeof expression_builder) => RuntimeExpression) => {
		return make_stage({ ...state, where_expressions: [...state.where_expressions, cb(expression_builder)] })
	},
	select: (...exprs: string[]) => {
		return make_stage({ ...state, selects: [...state.selects, ...map(exprs, to_select_expression)] })
	},
	group_by: (...exprs: string[]) => {
		return make_stage({ ...state, group_bys: [...state.group_bys, ...map(exprs, to_select_expression)] })
	},
	build: (): SafeSqlQuery => ({
		select: state.selects,
		from: state.from,
		joins: state.joins,
		where: state.where_expressions.flatMap(flatten_expression),
		group_by: state.group_bys,
	}),
})

const query_builder = <Schema extends SchemaColumnTypes>(): {
	from: <S extends TableAliasArg<Schema>>(
		table_alias: S,
	) => Stage<Schema, ParseTableAlias<S, Schema>>
} => ({
	from: ((table_alias: string) => {
		const { table, alias } = parse_table_alias(table_alias)
		return make_stage({
			from: { table_name: table, alias },
			joins: [],
			where_expressions: [],
			selects: [],
			group_bys: [],
		})
	}) as any,
})

export default query_builder
