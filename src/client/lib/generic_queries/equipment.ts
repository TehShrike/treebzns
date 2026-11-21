import type { ClientQueryFn } from '#lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'

export const select_equipment = (query: ClientQueryFn) => query(
	query_builder<Schema>()
		.from(`equipment`)
		.select(() => [
			`equipment.equipment_id`,
			`equipment.name`,
			`equipment.short_name`,
			`equipment.hourly_rate`,
			`equipment.created_at`,
			`equipment.updated_at`,
		] as const)
		.order_by(`equipment.name`, `ASC`)
		.build()
).get_table_identifier_rows(`equipment`)

export type EquipmentRow = Awaited<ReturnType<typeof select_equipment>>[number]
