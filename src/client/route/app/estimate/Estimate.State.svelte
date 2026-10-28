<script module lang="ts">
	import { state_type } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import assert from '#shared/assert.ts'
	import { validate_estimate_params } from './estimate_params.ts'

	const select_project = async (query: ClientQueryFn, project_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`project`)
				.where(q => q.comparison(`project.project_id`, `=`, { value: project_id }))
				.select(() => [
					`project.project_id`,
					`project.project_document_id`,
					`project.client_id`,
					`project.client_contact_id`,
					`project.address_line_1`,
					`project.address_line_2`,
					`project.city`,
					`project.state`,
					`project.zip`,
					`project.lead_details`,
					`project.estimated_crew_size`,
				] as const)
				.build(),
		)
		const row = rows[0]
		assert(row, `project ${project_id} exists`)

		return Object.freeze(row.project)
	}

	export const asr_state = state_type({
		name: `app.estimate`,
		route: `/estimate/:project_id`,
		default_child: `notes`,
		param_validator: validate_estimate_params,
		resolve: async ({ query }, { project_id }) => ({
			project: await select_project(query, project_id),
		}),
	})
</script>

<uiView></uiView>

<style>
	uiView {
		display: contents;
	}
</style>
