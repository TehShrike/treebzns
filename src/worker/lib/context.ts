import type { Connection } from 'mysql2/promise'
import type { TransactionConnection } from '#shared/mysql/helpers.ts'
import type {
	TenantedSelectBuilder,
	TransactionTenantedSelectBuilder,
} from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { ConnectionBoundWriteHelper } from '#shared/mysql/write_helper.ts'

export type TransactionContext = {
	connection: TransactionConnection<Connection>
	select_builder: TransactionTenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
}

export type Context = {
	user: Omit<DbEmployee, 'password_hash' | 'number_of_password_hash_iterations' | 'created_at' | 'updated_at' | 'arbostar_user_id' | 'estimator_sort'>
	company: Omit<DbCompany, 'created_at' | 'updated_at' | 'logo'>
	select_builder: TenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
	transaction: <Result>(fn: (context: TransactionContext) => Promise<Result>) => Promise<Result>
}
