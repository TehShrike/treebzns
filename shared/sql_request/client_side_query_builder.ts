import type {
	Comparator,
	TrustableSelectQuery,
	Comparison,
	ColumnReference,
	UserProvidedValue,
	Join as TrustableJoin,
	SelectExpression,
} from "./trustable_select_query.ts"

type SchemaColumnTypes = {
	[table_name in string]: {
		[column_name in string]: any
	}
}

type AliasMap<Schema extends SchemaColumnTypes> = {
	[alias: string]: Extract<keyof Schema, string>
}

type ColumnRef<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>> = {
	[Alias in keyof A & string]: {
		table: Alias
		column: Extract<keyof Schema[A[Alias]], string>
	}
}[keyof A & string]

type ValueRef = { value: unknown }

type Expression = { __expression: true }

type ExpressionBuilder<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>> = {
	comparison: (
		left: ColumnRef<Schema, A> | ValueRef,
		comparator: Comparator,
		right: ColumnRef<Schema, A> | ValueRef,
	) => Expression
	and: (...exprs: Expression[]) => Expression
}

type SelectColumnInput<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>> =
	ColumnRef<Schema, A> & { alias?: string }

type RowEntry<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>, Expr> =
	Expr extends { alias: infer K extends string; table: infer T; column: infer C }
		? T extends keyof A
			? C extends keyof Schema[A[T] & keyof Schema]
				? { [_ in K]: Schema[A[T] & keyof Schema][C] }
				: never
			: never
		: Expr extends { table: infer T; column: infer C extends string }
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

export type BuiltQuery<Row> = TrustableSelectQuery & { readonly __row_type?: Row }

export type ExtractQueryResponse<T> = T extends BuiltQuery<infer Row> ? { [K in keyof Row]: Row[K] } : never

type Stage<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>, Row = {}> = {
	join: <T extends Extract<keyof Schema, string>, NewAlias extends string>(
		table: T,
		alias: NewAlias,
		on: (b: ExpressionBuilder<Schema, A & { [K in NewAlias]: T }>) => Expression,
	) => Stage<Schema, A & { [K in NewAlias]: T }, Row>

	where: (
		cb: (b: ExpressionBuilder<Schema, A>) => Expression,
	) => Stage<Schema, A, Row>

	select: <const Exprs extends ReadonlyArray<SelectColumnInput<Schema, A>>>(
		...exprs: Exprs
	) => Stage<Schema, A, Row & RowFromSelectExprs<Schema, A, Exprs>>

	group_by: (...exprs: SelectColumnInput<Schema, A>[]) => Stage<Schema, A, Row>

	build: () => BuiltQuery<Row>
}

type ColumnOrValueInput = { table: string; column: string } | { value: unknown }

type RuntimeExpression =
	| { type: 'and'; children: RuntimeExpression[] }
	| Comparison

type SelectColumnInputRuntime = { table: string; column: string; alias?: string }

type State = {
	from: { table_name: string; alias: string }
	joins: TrustableJoin[]
	where_expressions: RuntimeExpression[]
	selects: SelectExpression[]
	group_bys: SelectExpression[]
}

const to_select_expression = (input: SelectColumnInputRuntime): SelectExpression => {
	const base = { type: 'column reference' as const, table_identifier: input.table, column: input.column }
	return input.alias === undefined ? base : { ...base, alias: input.alias }
}

const to_column_or_value = (input: ColumnOrValueInput): ColumnReference | UserProvidedValue => {
	if ('value' in input) {
		return { type: 'user provided value', value: input.value }
	}
	return { type: 'column reference', table_identifier: input.table, column: input.column }
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
}

const make_stage = (state: State): any => ({
	join: (table: string, alias: string, on: (b: typeof expression_builder) => RuntimeExpression) => {
		const expr = on(expression_builder)
		const next: State = {
			...state,
			joins: [...state.joins, { table_name: table, alias, on_clause: flatten_expression(expr) }],
		}
		return make_stage(next)
	},
	where: (cb: (b: typeof expression_builder) => RuntimeExpression) => {
		const expr = cb(expression_builder)
		const next: State = { ...state, where_expressions: [...state.where_expressions, expr] }
		return make_stage(next)
	},
	select: (...exprs: SelectColumnInputRuntime[]) => {
		const next: State = { ...state, selects: [...state.selects, ...exprs.map(to_select_expression)] }
		return make_stage(next)
	},
	group_by: (...exprs: SelectColumnInputRuntime[]) => {
		const next: State = { ...state, group_bys: [...state.group_bys, ...exprs.map(to_select_expression)] }
		return make_stage(next)
	},
	build: (): TrustableSelectQuery => ({
		select: state.selects,
		from: state.from,
		joins: state.joins,
		where: state.where_expressions.flatMap(flatten_expression),
		group_by: state.group_bys,
	}),
})

const query_builder = <Schema extends SchemaColumnTypes>(): {
	from: <From extends Extract<keyof Schema, string>, Alias extends string = From>(
		table: From,
		alias?: Alias,
	) => Stage<Schema, { [K in Alias]: From }>
} => ({
	from: ((table: string, alias?: string) => make_stage({
		from: { table_name: table, alias: alias ?? table },
		joins: [],
		where_expressions: [],
		selects: [],
		group_bys: [],
	})) as any,
})

export default query_builder
