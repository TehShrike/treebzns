import { Temporal } from '@js-temporal/polyfill'
import assert from '#shared/assert.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'

type ChangeContext = {
	project_id: bigint
	changed_by_employee_id: bigint
	timezone: string
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}

export const update_project_document = async ({
	project_id,
	project_document_id,
	changed_by_employee_id,
	timezone,
	select_builder,
	write_helper,
}: ChangeContext & { project_document_id: bigint }): Promise<{ changed: boolean }> => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project`)
		.where(q => q.comparison(`project.project_id`, `=`, { value: project_id }))
		.select(() => [`project.project_document_id`])
		.for_update()
		.build())
	assert(row, `project ${project_id} exists`)

	if (row.project.project_document_id === project_document_id) {
		return { changed: false }
	}

	const now = Temporal.Now.instant()
	const change_date = now.toZonedDateTimeISO(timezone).toPlainDate()

	await write_helper.update({
		table_name: `project`,
		column: `project_id`,
		value: project_id,
		set: {
			project_document_id,
			last_project_document_change_date: change_date,
			last_project_document_change_datetime: now,
		},
	})

	await write_helper.insert(`project_document_history`, {
		project_id,
		project_document_id,
		changed_by_employee_id,
		change_date,
		change_datetime: now,
	})

	return { changed: true }
}

export const move_project_to_next_project_document = async (context: ChangeContext): Promise<{ changed: boolean }> => {
	const { project_id, select_builder } = context
	const row = await select_builder.get_first_row(select_builder
		.from(`project`)
		.join(`project_document`, q => q.comparison(`project_document.project_document_id`, `=`, `project.project_document_id`))
		.where(q => q.comparison(`project.project_id`, `=`, { value: project_id }))
		.select(() => [`project_document.next_project_document_id`])
		.for_update()
		.build())
	assert(row, `project ${project_id} exists`)
	const next_project_document_id = row.project_document.next_project_document_id
	assert(next_project_document_id !== null, `the project document of project ${project_id} has a next project document`)

	return update_project_document({ ...context, project_document_id: next_project_document_id })
}
