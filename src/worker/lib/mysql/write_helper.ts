import type { InsertableSchema, Schema } from '#schema/types.ts'
import typed_write_helper from '#shared/sql_request/typed_write_helper.ts'
import * as schema from '#schema/all_table_column_names.ts'
import * as insertable_schema from '#schema/insertable_table_column_names.ts'

const write_helper = typed_write_helper<InsertableSchema, Schema>(schema, insertable_schema)

export default write_helper
