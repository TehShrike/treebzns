<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import Layout from '../Layout.svelte'
	import EstimateNavBar from '../EstimateNavBar.svelte'
	import { validate_line_item_params } from '../line_item_params.ts'
	import { fetch_line_items } from '../fetch_line_items.ts'
	import assert from '#shared/assert.ts'
	import { find_index } from '#shared/array.ts'

	export const asr_state = state_type({
		name: `app.estimate.line_item`,
		route: `/line_item/:project_line_item_id`,
		param_validator: validate_line_item_params,
		resolve: async ({ query, server }, { project_id, project_line_item_id }) => {
			const line_items = await fetch_line_items(query, project_id)

			const current_index = find_index(line_items, row => row.project_line_item_id === project_line_item_id)
			const line_item = line_items[current_index]
			assert(line_item, `line item ${project_line_item_id} belongs to project ${project_id}`)

			return { server, project_id, line_items, current_index, line_item }
		},
	})
</script>

<script lang="ts">
	const { server, project_id, line_items, current_index, line_item, asr }: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()
</script>

<Layout>
	{#snippet top()}
		<EstimateNavBar {asr} {server} {project_id} {line_items} {current_index} />
	{/snippet}

	<h2>{line_item.title}</h2>
</Layout>
