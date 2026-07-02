import type { Connection, ResultSetHeader } from 'mysql2/promise'
import { Temporal } from '@js-temporal/polyfill'
import { map, flatten } from '#shared/array.ts'
import object_keys from '#shared/object_keys.ts'
import assert from '#shared/assert.ts'

type InsertableSchemaShape = {
	[table_name: string]: {
		[column_name: string]: unknown
	}
}

type SchemaConstantsCovering<Insertable extends InsertableSchemaShape> = {
	[Table in keyof Insertable]: {
		[Column in keyof Insertable[Table]]: string
	}
}

// The row accepted for an insert: columns whose type includes null may be omitted (the database
// supplies its default); every other column is required.
type InsertRow<Row> =
	& { [Column in keyof Row as null extends Row[Column] ? never : Column]: Row[Column] }
	& { [Column in keyof Row as null extends Row[Column] ? Column : never]?: Row[Column] }

// A FinancialNumber is a plain object exposing arithmetic methods; detect it structurally so this
// shared module doesn't need to import the implementation.
const is_financial_number = (value: object): boolean =>
	typeof (value as { plus?: unknown }).plus === 'function'
	&& typeof (value as { times?: unknown }).times === 'function'

// The mysql2 driver serializes bigint, boolean, string, number, null and Buffer correctly, but not
// the richer domain types in an InsertableSchema. Convert those to the string forms MySQL expects.
const to_database_value = (value: unknown): unknown => {
	if (value instanceof Temporal.PlainDate) return value.toString()
	if (value !== null && typeof value === 'object' && is_financial_number(value)) return String(value)
	return value
}

const array_of = <T>(count: number, value: T): T[] => Array(count).fill(value)
const escape_identifier = (column_name: string): string => {
	assert(!column_name.includes('`'), `Column name "${column_name}" must not contain backticks`)
	return `\`${column_name}\``
}

const typed_insert_helper = <Insertable extends InsertableSchemaShape>(
	schema_constants: SchemaConstantsCovering<Insertable>,
	insertable_column_names: SchemaConstantsCovering<Insertable>,
) => {
	return {
		insert: async <Table extends keyof Insertable & string>(
			connection: Connection,
			table_name: Table,
			row: InsertRow<Insertable[Table]>,
		) => {
			assert(table_name in schema_constants, `Table "${table_name}" must exist in schema constants`)
			const entries = Object.entries(row)
			const column_list = map(entries, ([column]) => {
				assert(column in schema_constants[table_name], `Column "${column}" must exist in schema constants for table "${table_name}"`)
				return escape_identifier(column)
			}).join(', ')
			const placeholders = map(entries, () => '?').join(', ')
			const values = map(entries, ([, value]) => to_database_value(value))

			const sql = `INSERT INTO ${escape_identifier(table_name)} (${column_list}) VALUES (${placeholders})`
			const [{ insertId }] = await connection.query<ResultSetHeader>(sql, values)
			return { insert_id: BigInt(insertId) }
		},

		bulk_insert: async <Table extends keyof Insertable & string>(
			connection: Connection,
			table_name: Table,
			rows: InsertRow<Insertable[Table]>[],
		) => {
			assert(table_name in insertable_column_names, `Table "${table_name}" must exist in schema constants`)
			assert(rows.length > 0, `bulk_insert requires at least one row for table "${table_name}"`)

			const columns = object_keys(insertable_column_names[table_name])

			const question_mark_placeholders_for_all_rows = array_of(
				rows.length,
				`(${array_of(columns.length, '?').join(', ')})`
			).join(', ')
			const column_list = map(columns, column => escape_identifier(column)).join(', ')
			const sql = `INSERT INTO ${escape_identifier(table_name)} (${column_list}) VALUES ${question_mark_placeholders_for_all_rows}`


			const values = flatten(
				map(rows, row =>
					map(columns, column => {
						const value = (row as Record<string, unknown>)[column]

						return value === undefined
							? null
							: to_database_value(value)
					})
				)
			)

			await connection.query<ResultSetHeader>(sql, values)
		},
	}
}

export default typed_insert_helper
