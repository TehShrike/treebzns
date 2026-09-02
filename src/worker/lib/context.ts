import type { TenantedSelectBuilder } from "#worker/lib/db/make_tenanted_select_builder.ts";
import type { ConnectionBoundWriteHelper } from "#shared/mysql/write_helper.ts";

export type Context = {
	user: Omit<DbEmployee, 'password_hash' | 'number_of_password_hash_iterations' | 'created_at' | 'updated_at' | 'arbostar_user_id' | 'estimator_sort'>
	company: Omit<DbCompany, 'created_at' | 'updated_at' | 'logo'>
	select_builder: TenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
	transaction: <Result>(fn: () => Promise<Result>) => Promise<Result>
}
