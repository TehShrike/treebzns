import query_builder from '#shared/sql_request/typed_query_builder.ts'
import assert from '#shared/assert.ts'
import type { Schema } from '#schema/types.ts'
import type { TenantedSelectBuilder } from "#worker/lib/db/make_tenanted_select_builder.ts";

type TableWithOwnIdColumn = {
	[Table in keyof Schema & string]: `${Table}_id` extends keyof Schema[Table] ? Table : never
}[keyof Schema & string]

const assert_db_id_valid = async ({
	select_builder,
	table_name,
	id,
}: {
	select_builder: TenantedSelectBuilder
	table_name: TableWithOwnIdColumn
	id: bigint
}): Promise<void> => {
	const id_column: `${string}.${string}` = `${table_name}.${table_name}_id`
	const row = await select_builder.get_first_row(query_builder()
		.from(table_name)
		// @ts-expect-error This column name is validated by human logic and the power of deterministic string-building rather than the type checker
		.where(q => q.comparison(id_column, '=', { value: id })).select(() => [id_column])
		.build())
	assert(row)
}

export default assert_db_id_valid
