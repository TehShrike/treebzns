import type { MysqlHelpersObject } from "#worker/lib/mysql/mysql_helpers_object.ts";

export type Context = {
	user: Pick<DbEmployee, 'employee_id' | 'company_id'>
	mysql: MysqlHelpersObject
}
