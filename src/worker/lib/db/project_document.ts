import assert from '#shared/assert.ts'
import type { Context } from '#worker/lib/context.ts'

// The lead document is the lowest-sort project_document — the same rule create_company
// used when this lived on company.default_initial_project_document_id.
export const get_lead_project_document_id = async ({
	select_builder,
}: {
	select_builder: Context['select_builder']
}): Promise<bigint> => {
	const lead_document_row = await select_builder.get_first_row(select_builder
		.from('project_document')
		.order_by('project_document.sort', 'ASC')
		.limit(1n)
		.select(() => ['project_document.project_document_id'])
		.build())
	assert(lead_document_row)

	return lead_document_row.project_document.project_document_id
}
