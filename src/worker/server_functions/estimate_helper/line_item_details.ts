import assert from '#shared/assert.ts'
import type { TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import assert_db_id_valid from '#lib/db/assert_db_id_valid.ts'
import type { LineItemDetails, UpsertLineItemDetailsArgument } from '#shared/type/estimate.ts'
import { default_line_item, insert_line_item } from './line_item.ts'

type Db = {
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}

const insert_line_item_details = async ({
	details: { project_id, title, ...values },
	select_builder,
	write_helper,
}: { details: { project_id: bigint } & LineItemDetails } & Db): Promise<bigint> => {
	await assert_db_id_valid({ select_builder, table_name: `project`, id: project_id })

	const { project_line_item_id } = await insert_line_item({
		project_id,
		title,
		line_item: { ...default_line_item, ...values },
		select_builder,
		write_helper,
	})

	return project_line_item_id
}

const assert_line_item_in_project = async ({
	project_id,
	project_line_item_id,
	select_builder,
}: {
	project_id: bigint
	project_line_item_id: bigint
	select_builder: TransactionTenantedSelectBuilder
}) => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_line_item`)
		.where(q => q.comparison(`project_line_item.project_line_item_id`, `=`, { value: project_line_item_id }))
		.select(() => [`project_line_item.project_id`])
		.build())
	assert(row, `line item ${project_line_item_id} belongs to the company`)
	assert(row.project_line_item.project_id === project_id, `line item ${project_line_item_id} belongs to project ${project_id}`)
}

const update_line_item_details = async ({
	details: { project_id, project_line_item_id, ...changes },
	select_builder,
	write_helper,
}: { details: { project_id: bigint, project_line_item_id: bigint } & Partial<LineItemDetails> } & Db): Promise<bigint> => {
	await assert_line_item_in_project({ project_id, project_line_item_id, select_builder })

	if (Object.keys(changes).length > 0) {
		await write_helper.update({ table_name: `project_line_item`, column: `project_line_item_id`, value: project_line_item_id, set: changes })
	}

	return project_line_item_id
}

export const upsert_line_item_details = ({
	details,
	select_builder,
	write_helper,
}: { details: UpsertLineItemDetailsArgument } & Db): Promise<bigint> => details.project_line_item_id === null
	? insert_line_item_details({ details, select_builder, write_helper })
	: update_line_item_details({ details, select_builder, write_helper })
