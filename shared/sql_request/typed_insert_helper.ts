import type { Connection } from 'mysql2/promise'
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

const typed_insert_helper = <Insertable extends InsertableSchemaShape>(
	schema_constants: SchemaConstantsCovering<Insertable>,
) => {
	return {
		insert: <Table extends keyof Insertable & string>(
			connection: Connection,
			table_name: Table,
			row: Insertable[Table],
		) => {
			assert(table_name in schema_constants, `Table "${table_name}" must exist in schema constants`)
			const entries = Object.entries(row as Record<string, unknown>)
			const column_list = map(entries, ([column]) => {
				assert(column in schema_constants[table_name], `Column "${column}" must exist in schema constants for table "${table_name}"`)
				return `\`${column}\``
			}).join(', ')
			const placeholders = map(entries, () => '?').join(', ')
			const values = map(entries, ([, value]) => value)

			const sql = `INSERT INTO \`${table_name}\` (${column_list}) VALUES (${placeholders})`
			return connection.query(sql, values)
		},
	}
}

export default typed_insert_helper
