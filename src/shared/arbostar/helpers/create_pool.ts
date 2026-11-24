import { createPool } from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import { env_connection_options, static_connection_options, type MysqlEnv } from '#shared/mysql/connection.ts'

export const create_pool = (env: MysqlEnv): Pool =>
	createPool({
		...env_connection_options(env),
		...static_connection_options,
	})
