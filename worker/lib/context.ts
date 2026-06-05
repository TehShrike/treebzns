import type { MysqlHelpersObject } from "#worker/lib/mysql/mysql_helpers_object.ts";

export type Context = {
	user: Omit<DbEmployee, 'password_hash' | 'number_of_password_hash_iterations' | 'created_at' | 'updated_at'>
	company: Omit<DbCompany, 'created_at' | 'updated_at' | 'logo'>
	mysql: MysqlHelpersObject
}
