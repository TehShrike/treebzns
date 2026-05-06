import type { Comparator } from "./trustable_select_query.ts"

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

type Stage<Schema extends SchemaColumnTypes, A extends AliasMap<Schema>> = {
	join: <T extends Extract<keyof Schema, string>, NewAlias extends string>(
		table: T,
		alias: NewAlias,
		on: (b: ExpressionBuilder<Schema, A & { [K in NewAlias]: T }>) => Expression,
	) => Stage<Schema, A & { [K in NewAlias]: T }>

	where: (
		cb: (b: ExpressionBuilder<Schema, A>) => Expression,
	) => Stage<Schema, A>
}

const query_builder = <Schema extends SchemaColumnTypes>(): {
	from: <From extends Extract<keyof Schema, string>, Alias extends string = From>(
		table: From,
		alias?: Alias,
	) => Stage<Schema, { [K in Alias]: From }>
} => null as any

export default query_builder
