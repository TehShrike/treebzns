import type { Connection, ResultSetHeader } from 'mysql2/promise'
import { map, chunk, filter, for_each } from '#shared/array.ts'
import object_keys from '#shared/object_keys.ts'
import assert from '#shared/assert.ts'
import escape_value from '#shared/sql_request/escape_value.ts'

type SchemaShape = {
	[table_name: string]: {
		[column_name: string]: unknown
	}
}

type SchemaConstantsCovering<S extends SchemaShape> = {
	[Table in keyof S]: {
		[Column in keyof S[Table]]: string
	}
}

// The row accepted for an insert: columns whose type includes null may be omitted (the database
// supplies its default); every other column is required.
type InsertRow<Row> =
	& { [Column in keyof Row as null extends Row[Column] ? never : Column]: Row[Column] }
	& { [Column in keyof Row as null extends Row[Column] ? Column : never]?: Row[Column] }

// Explicitly-undefined columns are allowed (unlike Partial under exactOptionalPropertyTypes)
// and are skipped, so callers can build a set conditionally.
type UpdateSet<TableRow> = { [Column in keyof TableRow]?: TableRow[Column] | undefined }

// Excess-property checks only apply to object literals, so a set built elsewhere could smuggle
// in a column the table doesn't have; intersecting with this marks such columns as never.
type NoUnknownColumns<TableRow, Set> = { [Column in Exclude<keyof Set, keyof TableRow>]: never }

const escape_identifier = (column_name: string): string => {
	assert(!column_name.includes('`'), `Column name "${column_name}" must not contain backticks`)
	return `\`${column_name}\``
}

const typed_write_helper = <Insertable extends SchemaShape, Row extends SchemaShape>(
	schema_constants: SchemaConstantsCovering<Insertable> & SchemaConstantsCovering<Row>,
	insertable_column_names: SchemaConstantsCovering<Insertable>,
) => {
	const build_update_sql = <
		Table extends keyof Row & string,
		Key extends keyof Row[Table] & string,
		Set extends UpdateSet<Row[Table]>,
	>(
		table_name: Table,
		key_column: Key,
		key: Row[Table][Key],
		set: Set & NoUnknownColumns<Row[Table], Set>,
	): string => {
		assert(table_name in schema_constants, `Table "${table_name}" must exist in schema constants`)
		const table_columns = schema_constants[table_name] as Record<string, string>
		assert(key_column in table_columns, `Key column "${key_column}" must exist in schema constants for table "${table_name}"`)

		const entries = filter(Object.entries(set), ([, value]) => value !== undefined)
		assert(entries.length > 0, `An update of table "${table_name}" must set at least one column`)
		const set_sql = map(entries, ([column, value]) => {
			assert(column in table_columns, `Column "${column}" must exist in schema constants for table "${table_name}"`)
			return `${escape_identifier(column)} = ${escape_value(value)}`
		}).join(', ')

		return `UPDATE ${escape_identifier(table_name)} SET ${set_sql} WHERE ${escape_identifier(key_column)} = ${escape_value(key)}`
	}

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

		build_update_sql,

		update: async <
			Table extends keyof Row & string,
			Key extends keyof Row[Table] & string,
			Set extends UpdateSet<Row[Table]>,
		>(
			connection: Connection,
			table_name: Table,
			key_column: Key,
			key: Row[Table][Key],
			set: Set & NoUnknownColumns<Row[Table], Set>,
		): Promise<{ affected_rows: bigint }> => {
			const [{ affectedRows }] = await connection.query<ResultSetHeader>(
				build_update_sql(table_name, key_column, key, set),
			)
			return { affected_rows: BigInt(affectedRows) }
		},

		// One query round-trip per batch, containing one UPDATE statement per row (the connection
		// must have multipleStatements enabled). Rows may each set a different subset of columns.
		bulk_update: async <
			Table extends keyof Row & string,
			Key extends keyof Row[Table] & string,
			Set extends UpdateSet<Row[Table]>,
		>(
			connection: Connection,
			table_name: Table,
			key_column: Key,
			rows: Array<{ key: Row[Table][Key]; set: Set & NoUnknownColumns<Row[Table], Set> }>,
			rows_per_batch: number,
		): Promise<{ affected_rows: bigint }> => {
			assert(
				Number.isInteger(rows_per_batch) && rows_per_batch > 0,
				`rows_per_batch must be a positive integer, got ${rows_per_batch}`,
			)
			if (rows.length === 0) return { affected_rows: 0n }

			let affected_rows = 0n
			for (const batch of chunk(rows, rows_per_batch)) {
				const sql = map(batch, ({ key, set }) => build_update_sql(table_name, key_column, key, set)).join(';\n')
				const [result] = await connection.query<ResultSetHeader | ResultSetHeader[]>(sql)
				const headers = Array.isArray(result) ? result : [result]
				for_each(headers, ({ affectedRows }) => {
					affected_rows += BigInt(affectedRows)
				})
			}

			return { affected_rows }
		},
	}
}

export default typed_write_helper
