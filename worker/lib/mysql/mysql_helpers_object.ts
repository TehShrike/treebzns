import type { Connection, RowDataPacket } from 'mysql2/promise'

import {
	get_first_row, get_first_row_first_column, get_rows, get_insert_id, get_number_of_changed_rows, get_number_of_affected_rows,
} from './helpers.ts'
import type { QueryPromise } from './type.ts'

const make_handy_result_object = (query_promise: QueryPromise) => {
	const then: PromiseLike<null>['then'] = (on_fulfilled?, on_rejected?) => query_promise.then(() => null).then(on_fulfilled, on_rejected)

	return {
		get_first_row: <T = RowDataPacket>() => get_first_row(query_promise) as Promise<T>,
		get_first_row_first_column: <T = string>() => get_first_row_first_column(query_promise) as Promise<T>,
		get_rows: <T = RowDataPacket>() => get_rows(query_promise) as unknown as Promise<T[]>,
		get_insert_id: () => get_insert_id(query_promise),
		get_number_of_changed_rows: () => get_number_of_changed_rows(query_promise),
		get_number_of_affected_rows: () => get_number_of_affected_rows(query_promise),
		then,
	}
}

type Values = any[] | { [param: string]: any }
const make_mysql_helpers_object = (mysql: Connection) => ({
	query: (sql: { sql: string, values: Values } | string) => make_handy_result_object(mysql.query(typeof sql === 'object' ? sql : { sql })),
	connection: mysql,
})

export type MysqlHelpersObject = ReturnType<typeof make_mysql_helpers_object>

export default make_mysql_helpers_object
