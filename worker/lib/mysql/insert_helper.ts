import type { InsertableSchema } from '#schema/types.ts'
import typed_insert_helper from '#shared/sql_request/typed_insert_helper.ts'
import * as schema from '#schema/constants.ts'

const insert_helper = typed_insert_helper<InsertableSchema>(schema)

export default insert_helper
