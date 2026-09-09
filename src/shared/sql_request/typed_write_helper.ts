import type { Connection, ResultSetHeader } from 'mysql2/promise'
import { map, chunk, filter, for_each, some } from '#shared/array.ts'
import object_keys from '#shared/object_keys.ts'
import assert from '#shared/assert.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import escape_identifier from '#shared/sql_request/escape_identifier.ts'
import { type MySQLFunction, is_mysql_function } from '#shared/sql_request/mysql_function.ts'

type SchemaShape = {
	[table_name: string]: {
		[column_name: string]: unknown
	}
}

const company_id_column = 'company_id'
type CompanyIdColumn = typeof company_id_column

// Every written value may be either the column's TS value or a MySQLFunction claiming to
// produce that type.
type ColumnValue<T> = T | MySQLFunction<T>

type SchemaConstantsCovering<S extends SchemaShape> = {
	[Table in keyof S]: {
		[Column in keyof S[Table]]: string
	}
}

type TablesWithCompanyId<S extends SchemaShape> = {
	[Table in keyof S & string]: CompanyIdColumn extends keyof S[Table] ? Table : never
}[keyof S & string]

type TablesWithoutCompanyId<S extends SchemaShape> = {
	[Table in keyof S & string]: CompanyIdColumn extends keyof S[Table] ? never : Table
}[keyof S & string]

// The row accepted for an insert: columns whose type includes null may be omitted (the database
// supplies its default); every other column is required. company_id is never accepted — the
// helper supplies it from the company it was bound to.
type InsertRow<Row> =
	& { [Column in keyof Row as Column extends CompanyIdColumn ? never : null extends Row[Column] ? never : Column]: ColumnValue<Row[Column]> }
	& { [Column in keyof Row as Column extends CompanyIdColumn ? never : null extends Row[Column] ? Column : never]?: ColumnValue<Row[Column]> }

// Explicitly-undefined columns are allowed (unlike Partial under exactOptionalPropertyTypes)
// and are skipped, so callers can build a set conditionally. Mapping over Extract<keyof ...>
// rather than keyof keeps the mapped type non-homomorphic, so TS does not distribute it over
// a table row that is a union of variants (e.g. DbInvoice's tax/discount modes) — each column
// stays the union of its types across all variants.
type UpdateSet<TableRow> = {
	[Column in Exclude<Extract<keyof TableRow, string>, CompanyIdColumn>]?: ColumnValue<TableRow[Column]> | undefined
}

// Excess-property checks only apply to object literals, so a set built elsewhere could smuggle
// in a column the table doesn't have (or company_id); intersecting with this marks such columns as never.
type NoUnknownColumns<TableRow, SetClause> = { [Column in Exclude<keyof SetClause, Exclude<keyof TableRow, CompanyIdColumn>>]: never }

export type WriteHelper<
	Insertable extends SchemaShape,
	Row extends SchemaShape,
	InsertTable extends keyof Insertable & string,
	UpdateTable extends keyof Row & string,
> = {
	update_company_row: <
		Table extends UpdateTable,
		SetClause extends UpdateSet<Row[Table]>,
	>(
		table_name: Table,
		set: SetClause & NoUnknownColumns<Row[Table], SetClause>,
	) => Promise<{ affected_rows: bigint, insert_id: bigint }>
	insert: <Table extends InsertTable>(
		table_name: Table,
		row: InsertRow<Insertable[Table]>,
	) => Promise<{ insert_id: bigint }>
	bulk_insert: <Table extends InsertTable>(
		table_name: Table,
		rows: InsertRow<Insertable[Table]>[],
		rows_per_batch: number,
	) => Promise<{ insert_ids: bigint[] }>
	build_update_sql: <
		Table extends UpdateTable,
		Column extends keyof Row[Table] & string,
		SetClause extends UpdateSet<Row[Table]>,
	>(
		table_name: Table,
		column: Column,
		value: ColumnValue<Row[Table][Column]>,
		set: SetClause & NoUnknownColumns<Row[Table], SetClause>,
	) => string
	update: <
		Table extends UpdateTable,
		Column extends keyof Row[Table] & string,
		SetClause extends UpdateSet<Row[Table]>,
	>(
		table_name: Table,
		column: Column,
		value: ColumnValue<Row[Table][Column]>,
		set: SetClause & NoUnknownColumns<Row[Table], SetClause>,
	) => Promise<{ affected_rows: bigint, insert_id: bigint }>
	bulk_update: <
		Table extends UpdateTable,
		Column extends keyof Row[Table] & string,
		SetClause extends UpdateSet<Row[Table]>,
	>(
		table_name: Table,
		column: Column,
		rows: Array<{ value: ColumnValue<Row[Table][Column]>; set: SetClause & NoUnknownColumns<Row[Table], SetClause> }>,
		rows_per_batch: number,
	) => Promise<{ affected_rows: bigint }>
	delete: <
		Table extends UpdateTable,
		Column extends keyof Row[Table] & string,
	>(
		table_name: Table,
		column: Column,
		values: readonly ColumnValue<Row[Table][Column]>[],
		values_per_batch: number,
	) => Promise<{ affected_rows: bigint }>
}

// Bound to one company: writes only tables that have a company_id column, supplies company_id
// on every inserted row, and adds `AND company_id = ?` to every update and delete.
// update_company_row updates the company's single row in a table unique on company_id.
export type TenantedWriteHelper<
	Insertable extends SchemaShape,
	Row extends SchemaShape,
	UniqueOnCompanyId extends TablesWithCompanyId<Row> = never,
> =
	& Omit<WriteHelper<Insertable, Row, TablesWithCompanyId<Insertable>, TablesWithCompanyId<Row>>, 'update_company_row'>
	& Pick<WriteHelper<Insertable, Row, TablesWithCompanyId<Insertable>, UniqueOnCompanyId>, 'update_company_row'>

// Bound to no company: writes only tables that have no company_id column.
export type GlobalWriteHelper<Insertable extends SchemaShape, Row extends SchemaShape> =
	Omit<WriteHelper<Insertable, Row, TablesWithoutCompanyId<Insertable>, TablesWithoutCompanyId<Row>>, 'update_company_row'>

export type ForConnection<
	Insertable extends SchemaShape,
	Row extends SchemaShape,
	UniqueOnCompanyId extends TablesWithCompanyId<Row> = never,
> = {
	(arg: { connection: Connection, company_id: bigint }): TenantedWriteHelper<Insertable, Row, UniqueOnCompanyId>
	(arg: { connection: Connection, company_id: null }): GlobalWriteHelper<Insertable, Row>
}

const serialize_value = (value: unknown): string =>
	is_mysql_function(value) ? value.sql : escape_value(value)

const typed_write_helper = <
	Insertable extends SchemaShape,
	Row extends SchemaShape,
	UniqueOnCompanyId extends TablesWithCompanyId<Row> = never,
>({
	schema_constants,
	insertable_column_names,
	tables_unique_on_company_id,
}: {
	schema_constants: SchemaConstantsCovering<Insertable> & SchemaConstantsCovering<Row>,
	insertable_column_names: SchemaConstantsCovering<Insertable>,
	tables_unique_on_company_id: Record<UniqueOnCompanyId, string>,
}): ForConnection<Insertable, Row, UniqueOnCompanyId> => {
	for_each(object_keys(tables_unique_on_company_id), table_name => {
		assert(table_name in schema_constants, `Table "${table_name}" unique on company_id must exist in schema constants`)
		assert(
			company_id_column in (schema_constants[table_name] as Record<string, string>),
			`Table "${table_name}" unique on company_id must have a company_id column`,
		)
	})

	const make_helper = (
		connection: Connection,
		company_id: bigint | null,
	): WriteHelper<Insertable, Row, keyof Insertable & string, keyof Row & string> => {
		const assert_table_matches_company_scope = (table_name: string, table_columns: Record<string, string>) => {
			if (company_id === null) {
				assert(
					!(company_id_column in table_columns),
					`Table "${table_name}" has a company_id column, so it must be written through a write helper bound to a company`,
				)
			} else {
				assert(
					company_id_column in table_columns,
					`Table "${table_name}" has no company_id column, so it must be written through a write helper bound to no company`,
				)
			}
		}

		const assert_no_company_id_in = (what: string, columns: string[], table_name: string) => {
			assert(
				!some(columns, column => column === company_id_column),
				`The ${what} for table "${table_name}" must not contain company_id; the write helper supplies it`,
			)
		}

		const company_filter_sql = company_id === null
			? ''
			: ` AND ${escape_identifier(company_id_column)} = ${serialize_value(company_id)}`

		const table_columns_for_write = (table_name: string, column: string): Record<string, string> => {
			assert(table_name in schema_constants, `Table "${table_name}" must exist in schema constants`)
			const table_columns = schema_constants[table_name] as Record<string, string>
			assert_table_matches_company_scope(table_name, table_columns)
			assert(column in table_columns, `Column "${column}" must exist in schema constants for table "${table_name}"`)
			return table_columns
		}

		const build_update_sql_where = (table_name: string, table_columns: Record<string, string>, set: object, where_sql: string): string => {
			const entries = filter(Object.entries(set), ([, value]) => value !== undefined)
			assert(entries.length > 0, `An update of table "${table_name}" must set at least one column`)
			assert_no_company_id_in('set', map(entries, ([column]) => column), table_name)
			const assignments = map(entries, ([column, value]) => {
				assert(column in table_columns, `Column "${column}" must exist in schema constants for table "${table_name}"`)
				return `${escape_identifier(column)} = ${serialize_value(value)}`
			})
			if ('updated_at' in table_columns && !some(entries, ([column]) => column === 'updated_at')) {
				assignments.push('`updated_at` = UTC_TIMESTAMP()')
			}
			const set_sql = assignments.join(', ')

			return `UPDATE ${escape_identifier(table_name)} SET ${set_sql} WHERE ${where_sql}`
		}

		const build_update_sql: WriteHelper<Insertable, Row, keyof Insertable & string, keyof Row & string>['build_update_sql'] = (
			table_name,
			column,
			value,
			set,
		) => build_update_sql_where(
			table_name,
			table_columns_for_write(table_name, column),
			set,
			`${escape_identifier(column)} = ${serialize_value(value)}${company_filter_sql}`,
		)

		const update_company_row: WriteHelper<Insertable, Row, keyof Insertable & string, keyof Row & string>['update_company_row'] = async (
			table_name,
			set,
		) => {
			assert(company_id !== null, `update_company_row needs a write helper bound to a company`)
			assert(
				table_name in tables_unique_on_company_id,
				`Table "${table_name}" must be unique on company_id to update the company's row`,
			)
			const table_columns = table_columns_for_write(table_name, company_id_column)
			const [{ affectedRows, insertId }] = await connection.query<ResultSetHeader>(
				build_update_sql_where(table_name, table_columns, set, `${escape_identifier(company_id_column)} = ${serialize_value(company_id)}`),
			)
			return { affected_rows: BigInt(affectedRows), insert_id: BigInt(insertId) }
		}

		const insert: WriteHelper<Insertable, Row, keyof Insertable & string, keyof Row & string>['insert'] = async (table_name, row) => {
			assert(table_name in schema_constants, `Table "${table_name}" must exist in schema constants`)
			assert(table_name in insertable_column_names, `Table "${table_name}" must exist in insertable column names`)
			assert_table_matches_company_scope(table_name, insertable_column_names[table_name] as Record<string, string>)
			const row_entries: [string, unknown][] = Object.entries(row)
			assert_no_company_id_in('row', map(row_entries, ([column]) => column), table_name)
			const entries: [string, unknown][] = company_id === null ? row_entries : [[company_id_column, company_id], ...row_entries]
			const column_list = map(entries, ([column]) => {
				assert(column in schema_constants[table_name], `Column "${column}" must exist in schema constants for table "${table_name}"`)
				return escape_identifier(column)
			}).join(', ')
			const value_list = map(entries, ([, value]) => serialize_value(value)).join(', ')

			const sql = `INSERT INTO ${escape_identifier(table_name)} (${column_list}) VALUES (${value_list})`
			const [{ insertId }] = await connection.query<ResultSetHeader>(sql)
			return { insert_id: BigInt(insertId) }
		}

		const bulk_insert: WriteHelper<Insertable, Row, keyof Insertable & string, keyof Row & string>['bulk_insert'] = async (
			table_name,
			rows,
			rows_per_batch,
		) => {
			assert(table_name in insertable_column_names, `Table "${table_name}" must exist in insertable column names`)
			assert_table_matches_company_scope(table_name, insertable_column_names[table_name] as Record<string, string>)
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
				const value_rows = map(batch, row => {
					const row_columns = row as Record<string, unknown>
					assert_no_company_id_in('row', object_keys(row_columns), table_name)
					return `(${
						map(columns, column => {
							if (column === company_id_column) return serialize_value(company_id)
							const value = row_columns[column]

							return serialize_value(value === undefined ? null : value)
						}).join(', ')
					})`
				}).join(', ')

				const [{ insertId }] = await connection.query<ResultSetHeader>(insert_prefix + value_rows)
				// A multi-row INSERT with a known row count is a "simple insert": InnoDB allocates its
				// auto-increment ids as one consecutive block, so each row's id is insertId plus its offset.
				const first_insert_id = BigInt(insertId)
				for_each(batch, (_, index) => insert_ids.push(first_insert_id + BigInt(index)))
			}

			return { insert_ids }
		}

		const update: WriteHelper<Insertable, Row, keyof Insertable & string, keyof Row & string>['update'] = async (
			table_name,
			column,
			value,
			set,
		) => {
			const [{ affectedRows, insertId }] = await connection.query<ResultSetHeader>(
				build_update_sql(table_name, column, value, set),
			)
			return { affected_rows: BigInt(affectedRows), insert_id: BigInt(insertId) }
		}

		// One query round-trip per batch, containing one UPDATE statement per row (the connection
		// must have multipleStatements enabled). Rows may each set a different subset of columns.
		const bulk_update: WriteHelper<Insertable, Row, keyof Insertable & string, keyof Row & string>['bulk_update'] = async (
			table_name,
			column,
			rows,
			rows_per_batch,
		) => {
			assert(
				Number.isInteger(rows_per_batch) && rows_per_batch > 0,
				`rows_per_batch must be a positive integer, got ${rows_per_batch}`,
			)
			if (rows.length === 0) return { affected_rows: 0n }

			let affected_rows = 0n
			for (const batch of chunk(rows, rows_per_batch)) {
				const sql = map(batch, ({ value, set }) => build_update_sql(table_name, column, value, set)).join(';\n')
				const [result] = await connection.query<ResultSetHeader | ResultSetHeader[]>(sql)
				const headers = Array.isArray(result) ? result : [result]
				for_each(headers, ({ affectedRows }) => {
					affected_rows += BigInt(affectedRows)
				})
			}

			return { affected_rows }
		}

		const delete_rows: WriteHelper<Insertable, Row, keyof Insertable & string, keyof Row & string>['delete'] = async (
			table_name,
			column,
			values,
			values_per_batch,
		) => {
			table_columns_for_write(table_name, column)
			assert(
				Number.isInteger(values_per_batch) && values_per_batch > 0,
				`values_per_batch must be a positive integer, got ${values_per_batch}`,
			)
			if (values.length === 0) return { affected_rows: 0n }

			let affected_rows = 0n
			for (const batch of chunk(values, values_per_batch)) {
				const value_list = map(batch, value => serialize_value(value)).join(', ')
				const [{ affectedRows }] = await connection.query<ResultSetHeader>(
					`DELETE FROM ${escape_identifier(table_name)} WHERE ${escape_identifier(column)} IN (${value_list})${company_filter_sql}`,
				)
				affected_rows += BigInt(affectedRows)
			}

			return { affected_rows }
		}

		return { insert, bulk_insert, build_update_sql, update, update_company_row, bulk_update, delete: delete_rows }
	}

	const for_connection_and_company: ForConnection<Insertable, Row, UniqueOnCompanyId> = (
		{ connection, company_id }: { connection: Connection, company_id: bigint | null },
	) => make_helper(connection, company_id)

	return for_connection_and_company
}

export default typed_write_helper
