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

		// One UPDATE per batch: each column becomes a CASE over the key column, so a batch of
		// heterogeneous row values still updates in a single statement without touching
		// auto-increment (unlike INSERT ... ON DUPLICATE KEY UPDATE). Every row must set the
		// same columns (they're taken from the first row).
		bulk_update: async <Table extends keyof Insertable & string>(
			connection: Connection,
			table_name: Table,
			key_column: string,
			rows: Array<{ key: bigint; set: Partial<Insertable[Table]> }>,
			rows_per_batch: number,
		): Promise<{ affected_rows: bigint }> => {
			assert(table_name in schema_constants, `Table "${table_name}" must exist in schema constants`)
			assert(key_column in schema_constants[table_name], `Key column "${key_column}" must exist in schema constants for table "${table_name}"`)
			assert(
				Number.isInteger(rows_per_batch) && rows_per_batch > 0,
				`rows_per_batch must be a positive integer, got ${rows_per_batch}`,
			)
			if (rows.length === 0) return { affected_rows: 0n }

			const columns = Object.keys(rows[0]!.set)
			assert(columns.length > 0, `bulk_update rows must set at least one column for table "${table_name}"`)
			for_each(columns, column => {
				assert(column in schema_constants[table_name], `Column "${column}" must exist in schema constants for table "${table_name}"`)
			})

			let affected_rows = 0n
			for (const batch of chunk(rows, rows_per_batch)) {
				const set_sql = map(columns, column =>
					`${escape_identifier(column)} = CASE ${escape_identifier(key_column)} ${
						map(batch, ({ key, set }) => {
							const value = (set as Record<string, unknown>)[column]
							assert(value !== undefined, `bulk_update row for key ${key} must set column "${column}" like the first row does`)
							return `WHEN ${escape_value(key)} THEN ${escape_value(value)}`
						}).join(' ')
					} END`
				).join(', ')
				const key_list = map(batch, ({ key }) => escape_value(key)).join(', ')

				const [{ affectedRows }] = await connection.query<ResultSetHeader>(
					`UPDATE ${escape_identifier(table_name)} SET ${set_sql} WHERE ${escape_identifier(key_column)} IN (${key_list})`,
				)
				affected_rows += BigInt(affectedRows)
			}

			return { affected_rows }
		},
	}
}

export default typed_insert_helper
