import { for_each, map } from '#shared/array.ts'
import assert from '#shared/assert.ts'

type TableRow = { [column: string]: unknown }
type JoinedRow = { [table_identifier: string]: TableRow }

export type GroupingSpec<Row> = {
	[Table in keyof Row & string]: {
		table: Table
		key: keyof Row[Table] & string
		one_to_one?: readonly Exclude<keyof Row & string, Table>[]
		children?: { [property_name: string]: GroupingSpec<Row> }
	}
}[keyof Row & string]

// The query builder types a left-joined table as "matched row | all-null row". Grouping keeps a
// row only when its key is non-null, which proves the join matched, so the all-null variant is
// dropped and every column keeps its schema nullability.
type MatchedRow<Table, Key> = Table extends { [_ in Key & PropertyKey]: null } ? never : Table

type LevelRow<Row, Spec> =
	Spec extends { table: infer Table extends keyof Row; key: infer Key }
		? MatchedRow<Row[Table], Key>
		: never

type OneToOneRows<Row, Spec> =
	Spec extends { one_to_one: infer Tables extends readonly (keyof Row)[] }
		? { [Table in Tables[number]]: Row[Table] }
		: unknown

type ChildRows<Row, Spec> =
	Spec extends { children: infer Children }
		? { [Name in keyof Children]: GroupedRow<Row, Children[Name]>[] }
		: unknown

export type GroupedRow<Row, Spec> =
	Spec extends { one_to_one: readonly unknown[] } | { children: object }
		? Spec extends { table: infer Table extends keyof Row }
			? { [_ in Table]: LevelRow<Row, Spec> } & OneToOneRows<Row, Spec> & ChildRows<Row, Spec>
			: never
		: LevelRow<Row, Spec>

type RuntimeSpec = {
	table: string
	key: string
	one_to_one?: readonly string[]
	children?: { [property_name: string]: RuntimeSpec }
}

const group_level = (rows: readonly JoinedRow[], spec: RuntimeSpec): unknown[] => {
	const rows_by_key = new Map<unknown, JoinedRow[]>()
	for_each(rows, row => {
		const table_row = row[spec.table]
		assert(table_row, `the row has an object for table identifier "${spec.table}"`)
		assert(spec.key in table_row, `the "${spec.table}" object has a "${spec.key}" column`)
		const key_value = table_row[spec.key]
		if (key_value === null) {
			return
		}
		const group = rows_by_key.get(key_value)
		if (group) {
			group.push(row)
		} else {
			rows_by_key.set(key_value, [row])
		}
	})

	const groups = [...rows_by_key.values()]
	const { one_to_one, children } = spec
	if (!one_to_one && !children) {
		return map(groups, rows_for_key => rows_for_key[0]![spec.table])
	}

	const child_names = children ? Object.keys(children) : []
	return map(groups, rows_for_key => {
		const first_row = rows_for_key[0]!
		const result: { [property_name: string]: unknown } = { [spec.table]: first_row[spec.table] }
		for_each(one_to_one ?? [], table => {
			assert(first_row[table], `the row has an object for table identifier "${table}"`)
			result[table] = first_row[table]
		})
		for_each(child_names, name => {
			result[name] = group_level(rows_for_key, children![name]!)
		})
		return result
	})
}

const group_joined_rows = <Row extends JoinedRow, const Spec extends GroupingSpec<Row>>(
	rows: readonly Row[],
	spec: Spec,
): GroupedRow<Row, Spec>[] => group_level(rows, spec) as GroupedRow<Row, Spec>[]

export default group_joined_rows
