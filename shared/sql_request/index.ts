type ColumnReference = {
	type: 'column reference'
	table_identifier: string
	column: string
}

type SelectExpression = ColumnReference & {
	alias?: string
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

type Join = TableAddition & {
	on_clause: Array<Comparison>
}

type TrustableSelectQuery = {
	select: SelectExpression
	from: TableAddition
	joins: Array<Join>
	where: Array<Comparison>
}
