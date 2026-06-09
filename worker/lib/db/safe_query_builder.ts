import { make_safe_query_builder } from '#shared/sql_request/safe_sql_query.ts'
import * as schema from '#schema/constants.ts'

export default make_safe_query_builder(schema)
