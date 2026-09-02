import type { Connection } from 'mysql2/promise'

import type { QueryPromise } from './type.ts'

type Values = any[] | { [param: string]: any }
type QueryArg = { sql: string, values: Values } | string

export type QueryLog = (sql: string, ms: number, values: Values | undefined, error: unknown) => void

const green = '\x1b[32m'
const yellow = '\x1b[33m'
const red = '\x1b[31m'
const reset = '\x1b[0m'

const ms_color = (ms: number) => ms < 80 ? green : ms < 200 ? yellow : red

type MysqlServerError = Error & { code: string, errno: number, sqlMessage: string }

const is_mysql_server_error = (error: unknown): error is MysqlServerError =>
	error instanceof Error && typeof (error as Partial<MysqlServerError>).sqlMessage === 'string'

const error_text = (error: unknown) => {
	if (is_mysql_server_error(error)) {
		return `${ error.code } (${ error.errno }): ${ error.sqlMessage }`
	} else if (error instanceof Error) {
		return error.stack ?? error.message
	}
	return String(error)
}

const default_log: QueryLog = (sql, ms, values, error) => {
	console.log(`[👀 mysql ${ ms_color(ms) }${ ms }ms${ reset }]\n${sql}`)
	if (values !== undefined) {
		console.log(values)
	}
	if (error !== undefined) {
		console.error(`${ red }${ error_text(error) }${ reset }`)
	}
}

const wrap_connection_with_query_logger = (connection: Connection, log: QueryLog = default_log): Connection => {
	const query = (sql: QueryArg): QueryPromise => {
		const start = performance.now()
		const query_promise = connection.query(typeof sql === 'object' ? sql : { sql }) as QueryPromise

		const log_query = (error: unknown) => {
			const ms = performance.now() - start
			if (typeof sql === 'object') {
				log(sql.sql, ms, sql.values, error)
			} else {
				log(sql, ms, undefined, error)
			}
		}

		query_promise.then(() => log_query(undefined), log_query)

		return query_promise
	}

	return Object.create(connection, {
		query: { value: query, writable: true, enumerable: true, configurable: true },
	}) as Connection
}

export default wrap_connection_with_query_logger
