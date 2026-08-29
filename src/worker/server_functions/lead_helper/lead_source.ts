import assert from '#shared/assert.ts'
import is_duplicate_key_error from '#worker/lib/mysql/is_duplicate_key_error.ts'
import type { TenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { ConnectionBoundWriteHelper } from '#worker/lib/mysql/write_helper.ts'

export const insert_lead_source = async ({
	lead_source_name,
	company_id,
	select_builder,
	write_helper,
}: {
	lead_source_name: string
	company_id: bigint
	select_builder: TenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
}) => {
	try {
		const { insert_id: lead_source_id } = await write_helper.insert('lead_source', {
			company_id,
			name: lead_source_name,
		})

		return lead_source_id
	} catch (error) {
		if (is_duplicate_key_error(error)) {
			const lead_source_row = await select_builder.get_first_row(select_builder
				.from('lead_source')
				.where(q => q.comparison('lead_source.name', '=', { value: lead_source_name }))
				.select(() => ['lead_source.lead_source_id'])
				.build())
			assert(lead_source_row)

			return lead_source_row.lead_source.lead_source_id
		}

		throw error
	}
}
