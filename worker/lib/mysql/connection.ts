import { createPool } from 'mysql2/promise'
import type { Pool, ConnectionOptions } from 'mysql2/promise'
import fnum from '#shared/number.ts'

const time_types = new Set([ `TIMESTAMP`, `DATETIME` ])
const database_utc_offset = `Z`

export type Field = {
  type:
    | 'DECIMAL'
    | 'TINY'
    | 'SHORT'
    | 'LONG'
    | 'FLOAT'
    | 'DOUBLE'
    | 'NULL'
    | 'TIMESTAMP'
    | 'TIMESTAMP2'
    | 'LONGLONG'
    | 'INT24'
    | 'DATE'
    | 'TIME'
    | 'TIME2'
    | 'DATETIME'
    | 'DATETIME2'
    | 'YEAR'
    | 'NEWDATE'
    | 'VARCHAR'
    | 'BIT'
    | 'VECTOR'
    | 'JSON'
    | 'NEWDECIMAL'
    | 'ENUM'
    | 'SET'
    | 'TINY_BLOB'
    | 'MEDIUM_BLOB'
    | 'LONG_BLOB'
    | 'BLOB'
    | 'VAR_STRING'
    | 'STRING'
    | 'GEOMETRY'
  length: number;
  db: string;
  table: string;
  name: string;
  string: (encoding?: BufferEncoding | string | undefined) => string | null;
  buffer: () => Buffer | null;
  // geometry: () => Geometry | Geometry[] | null;
}

type MysqlDateTypes = 'TIMESTAMP' | 'DATETIME' | 'DATE'
const date_types_we_want_returned_as_strings: MysqlDateTypes[] = [ `TIMESTAMP`, `DATETIME`, `DATE` ]

const static_connection_options: ConnectionOptions = {
	multipleStatements: true,
	supportBigNumbers: true,
	timezone: `+00:00`,
	dateStrings: date_types_we_want_returned_as_strings,
	typeCast: (field: Field, next: () => unknown) => {
		if (field.type === `BIT` && field.length === 1) {
			const buffer = field.buffer()
			if (buffer === null) {
				return buffer
			}
			const as_number = Array.from(buffer.values())[0]
			return as_number === 1 || as_number === 49 // also check if 49 (ASCII code for 1) because of this bug: https://bugs.mysql.com/bug.php?id=97067
		} else if (field.type === `NEWDECIMAL`) {
			const decimal_string = field.string()
			if (decimal_string === null) {
				return null
			}
			return fnum(decimal_string)
		} else if (time_types.has(field.type)) {
			const datetime_string = field.string()
			if (datetime_string === null) {
				return null
			}
			return datetime_string.replace(` `, `T`) + database_utc_offset
		}

		return next()
	},
}

export const create_pool = (env: Env): Pool =>
	createPool({
		host: env.MYSQL_HOST,
		user: env.MYSQL_USER,
		password: env.MYSQL_PASS,
		database: env.MYSQL_DB,
		disableEval: true,
	})
