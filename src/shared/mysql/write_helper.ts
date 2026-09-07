import type { InsertableSchema, Schema } from '#schema/types.ts'
import typed_write_helper, {
	type TenantedWriteHelper as GenericTenantedWriteHelper,
	type GlobalWriteHelper as GenericGlobalWriteHelper,
} from '#shared/sql_request/typed_write_helper.ts'
import * as schema from '#schema/all_table_column_names.ts'
import * as insertable_schema from '#schema/insertable_table_column_names.ts'

const make_write_helper = typed_write_helper<InsertableSchema, Schema>({
	schema_constants: schema,
	insertable_column_names: insertable_schema,
})

export type TenantedWriteHelper = GenericTenantedWriteHelper<InsertableSchema, Schema>
export type GlobalWriteHelper = GenericGlobalWriteHelper<InsertableSchema, Schema>

export default make_write_helper
