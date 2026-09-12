import assert from '#shared/assert.ts'
import type { Context } from '#worker/lib/context.ts'

export const get_lead_needing_estimate_project_document_id = async ({
	select_builder,
}: {
	select_builder: Context['select_builder']
}): Promise<bigint> => {
	const lead_document_row = await select_builder.get_first_row(select_builder
		.from('project_document')
		.where(q => q.comparison('project_document.needs_estimate_to_move_on', '=', { value: true }))
		.order_by('project_document.sort', 'ASC')
		.limit(1n)
		.select(() => ['project_document.project_document_id'])
		.build())
	assert(lead_document_row, `a project_document with needs_estimate_to_move_on exists`)

	return lead_document_row.project_document.project_document_id
}
