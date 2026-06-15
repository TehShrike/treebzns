import type { Connection, ResultSetHeader } from 'mysql2/promise'
import { Temporal } from '@js-temporal/polyfill'
import { map } from '#shared/array.ts'
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

const typed_insert_helper = <Insertable extends InsertableSchemaShape>(
	schema_constants: SchemaConstantsCovering<Insertable>,
) => {
	return {
		insert: async <Table extends keyof Insertable & string>(
			connection: Connection,
			table_name: Table,
			row: InsertRow<Insertable[Table]>,
		) => {
			assert(table_name in schema_constants, `Table "${table_name}" must exist in schema constants`)
			const entries = Object.entries(row as Record<string, unknown>)
			const column_list = map(entries, ([column]) => {
				assert(column in schema_constants[table_name], `Column "${column}" must exist in schema constants for table "${table_name}"`)
				return `\`${column}\``
			}).join(', ')
			const placeholders = map(entries, () => '?').join(', ')
			const values = map(entries, ([, value]) => to_database_value(value))

			const sql = `INSERT INTO \`${table_name}\` (${column_list}) VALUES (${placeholders})`
			const [{ insertId }] = await connection.query<ResultSetHeader>(sql, values)
			return { insert_id: BigInt(insertId) }
		},
	}
}

export default typed_insert_helper
