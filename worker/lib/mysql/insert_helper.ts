import type { InsertableSchema } from '#schema/types.ts'
import typed_insert_helper from '#shared/sql_request/typed_insert_helper.ts'
import * as schema from '#schema/all_table_column_names.ts'
import * as insertable_schema from '#schema/insertable_table_column_names.ts'

const insert_helper = typed_insert_helper<InsertableSchema>(schema, insertable_schema)

export default insert_helper
