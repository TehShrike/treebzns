import type { Connection, ResultSetHeader } from 'mysql2/promise'
import { map, chunk, for_each } from '#shared/array.ts'
import object_keys from '#shared/object_keys.ts'
import assert from '#shared/assert.ts'
import escape_value from '#shared/sql_request/escape_value.ts'

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
			const value_list = map(entries, ([, value]) => escape_value(value)).join(', ')

			const sql = `INSERT INTO ${escape_identifier(table_name)} (${column_list}) VALUES (${value_list})`
			const [{ insertId }] = await connection.query<ResultSetHeader>(sql)
			return { insert_id: BigInt(insertId) }
		},

		bulk_insert: async <Table extends keyof Insertable & string>(
			connection: Connection,
			table_name: Table,
			rows: InsertRow<Insertable[Table]>[],
			rows_per_batch: number,
		): Promise<{ insert_ids: bigint[] }> => {
			assert(table_name in insertable_column_names, `Table "${table_name}" must exist in schema constants`)
			assert(rows.length > 0, `bulk_insert requires at least one row for table "${table_name}"`)
			assert(
				Number.isInteger(rows_per_batch) && rows_per_batch > 0,
				`rows_per_batch must be a positive integer, got ${rows_per_batch}`,
			)

			const columns = object_keys(insertable_column_names[table_name])
			const column_list = map(columns, column => escape_identifier(column)).join(', ')
			const insert_prefix = `INSERT INTO ${escape_identifier(table_name)} (${column_list}) VALUES `

			const insert_ids: bigint[] = []
			for (const batch of chunk(rows, rows_per_batch)) {
				const value_rows = map(batch, row =>
					`(${
						map(columns, column => {
							const value = (row as Record<string, unknown>)[column]

							return escape_value(value === undefined ? null : value)
						}).join(', ')
					})`
				).join(', ')

				const [{ insertId }] = await connection.query<ResultSetHeader>(insert_prefix + value_rows)
				// A multi-row INSERT with a known row count is a "simple insert": InnoDB allocates its
				// auto-increment ids as one consecutive block, so each row's id is insertId plus its offset.
				const first_insert_id = BigInt(insertId)
				for_each(batch, (_, index) => insert_ids.push(first_insert_id + BigInt(index)))
			}

			return { insert_ids }
		},
	}
}

export default typed_insert_helper
