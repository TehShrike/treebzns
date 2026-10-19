import query_builder from '#shared/sql_request/typed_query_builder.ts'
import assert from '#shared/assert.ts'
import type { Schema } from '#schema/types.ts'
import type { TenantedSelectBuilder } from "#shared/treebzns_db/make_tenanted_select_builder.ts";

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

export const assert_db_ids_valid = async ({
	select_builder,
	table_name,
	ids,
}: {
	select_builder: TenantedSelectBuilder
	table_name: TableWithOwnIdColumn
	ids: Iterable<bigint>
}): Promise<void> => {
	const unique_ids = [...new Set(ids)]
	if (unique_ids.length === 0) {
		return
	}

	const id_column: `${string}.${string}` = `${table_name}.${table_name}_id`
	const row: Record<string, { matching_count: bigint }> | null = await select_builder.get_first_row(query_builder()
		.from(table_name)
		// @ts-expect-error This column name is validated by human logic and the power of deterministic string-building rather than the type checker
		.where(q => q.in(id_column, unique_ids))
		// @ts-expect-error This column name is validated by human logic and the power of deterministic string-building rather than the type checker
		.select(q => [q.fn('COUNT', id_column, `${table_name}.matching_count`)])
		.build())
	assert(row, `an aggregate query returns exactly one row`)
	assert(row[table_name]!.matching_count === BigInt(unique_ids.length), `every ${table_name} id matches one row`)
}

export default assert_db_id_valid
