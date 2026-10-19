import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'

export const select_work_skills = (query: ClientQueryFn) => query(
	query_builder<Schema>()
		.from(`work_skill`)
		.select(() => [
			`work_skill.work_skill_id`,
			`work_skill.name`,
			`work_skill.short_name`,
			`work_skill.hourly_rate`,
			`work_skill.created_at`,
			`work_skill.updated_at`,
		] as const)
		.order_by(`work_skill.name`, `ASC`)
		.build()
).get_table_identifier_rows(`work_skill`)

export type WorkSkillRow = Awaited<ReturnType<typeof select_work_skills>>[number]
