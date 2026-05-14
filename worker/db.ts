import { createPool } from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import type { Env } from './environment.ts'

export const create_pool = (env: Env): Pool =>
	createPool({
		host: env.MYSQL_HOST,
		user: env.MYSQL_USER,
		password: env.MYSQL_PASS,
		database: env.MYSQL_DB,
		disableEval: true,
	})
