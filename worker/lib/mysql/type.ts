import type { OkPacket, RowDataPacket, FieldPacket } from 'mysql2/promise'

export type QueryResultSet = OkPacket & RowDataPacket[]

export type QueryPromise = Promise<[QueryResultSet, FieldPacket[]]>

export type Mysql = {
	query: (sql: string, values?: any[]) => QueryPromise
}
