import assert from '#shared/assert.ts'
import type { TransactionTenantedSelectBuilder } from './make_tenanted_select_builder.ts'

type SortableClientTable = 'client_address' | 'client_contact'

export const get_next_sort = async ({
	select_builder,
	table_name,
	client_id,
}: {
	select_builder: TransactionTenantedSelectBuilder
	table_name: SortableClientTable
	client_id: bigint
}): Promise<bigint> => {
	const row = await select_builder.get_first_row(select_builder
		.from(`${table_name} AS sortable`)
		.where(q => q.comparison('sortable.client_id', '=', { value: client_id }))
		.select(q => [q.fn('MAX', 'sortable.sort', 'sortable.max_sort')])
		.for_update()
		.build())
	assert(row, `An aggregate query returns exactly one row`)

	const current_max_sort = row.sortable.max_sort === null ? 0n : row.sortable.max_sort
	return current_max_sort + 1n
}
