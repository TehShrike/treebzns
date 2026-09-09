import { Temporal } from '@js-temporal/polyfill'
import escape_value from '#shared/sql_request/escape_value.ts'
import escape_identifier from '#shared/sql_request/escape_identifier.ts'

declare const return_type: unique symbol
const mysql_function = Symbol('mysql function')

// return_type is a phantom key that exists only at the type level. It records the TS type the
// database hands back when the column is read, so a function is only assignable to columns of
// that type.
export type MySQLFunction<T> = {
	readonly [mysql_function]: true
	readonly sql: string
	readonly [return_type]?: T
}

const make_mysql_function_object = <T>(sql: string): MySQLFunction<T> => ({ [mysql_function]: true, sql })

export const is_mysql_function = (value: unknown): value is MySQLFunction<unknown> =>
	typeof value === 'object' && value !== null && mysql_function in value

// The claimed return types are assertions. Each one must match the TS type that the
// connection's typeCast maps the function's MySQL type to (DATETIME → Temporal.Instant,
// BINARY → Buffer, ...). Check that mapping before adding a function here.
export const fns = {
	utc_timestamp: () => make_mysql_function_object<Temporal.Instant>('UTC_TIMESTAMP()'),
	uuid_to_bin: (uuid: string) => make_mysql_function_object<Buffer>(`UUID_TO_BIN(${escape_value(uuid)})`),
	// This function breaks type checking on the column name.  We need some way to validate column names
	// passed into these functions.
	last_insert_id_increment: (column_name: string, increment: bigint) =>
		make_mysql_function_object<bigint>(`LAST_INSERT_ID(${escape_identifier(column_name)}) + ${increment}`),
	greatest_of_column_and: (column_name: string, value: bigint) =>
		make_mysql_function_object<bigint>(`GREATEST(${escape_identifier(column_name)}, ${value})`),
}
