<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import type { StateParamsByName } from '#client/lib/state_names.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import { map } from '#shared/array.ts'
	import { untrack } from 'svelte'
	import { validate_project_search_params } from './project_search_params.ts'

	const fetch_project_documents = async (query: ClientQueryFn) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`project_document`)
				.order_by(`project_document.name`)
				.select(() => [
					`project_document.project_document_id`,
					`project_document.name`,
				] as const)
				.build()
		)
		return map(rows, row => row.project_document)
	}

	export const asr_state = state_type({
		name: `app.projects`,
		route: `/projects`,
		default_child: `results`,
		param_validator: validate_project_search_params,
		resolve: async ({ query, transition_state }, params) => {
			return {
				transition_state,
				project_documents: await fetch_project_documents(query),
				initial_search: {
					project_document_ids: params.project_document_ids ?? [],
					open_or_closed: params.open_or_closed ?? `open`,
					needs_client_approval: params.needs_client_approval ?? false,
				},
			}
		},
	})
</script>

<script lang="ts">
	const { project_documents, initial_search, transition_state, asr }: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()

	const loading_new_results = $derived(
		transition_state.currently_transitioning
		&& (transition_state.state_being_transitioned_to.name === `app.projects`
			|| transition_state.state_being_transitioned_to.name.startsWith(`app.projects.`))
	)

	// svelte-ignore state_referenced_locally
	let selected_project_document_ids = $state([...initial_search.project_document_ids])
	// svelte-ignore state_referenced_locally
	let open_or_closed = $state(initial_search.open_or_closed)
	// svelte-ignore state_referenced_locally
	let needs_client_approval = $state(initial_search.needs_client_approval)

	$effect(() => {
		const search_params: StateParamsByName[`app.projects.results`] = {}
		if (selected_project_document_ids.length > 0) {
			search_params.project_document_ids = selected_project_document_ids
		}
		if (open_or_closed === `closed`) {
			search_params.open_or_closed = `closed`
		}
		if (needs_client_approval) {
			search_params.needs_client_approval = true
		}
		untrack(() => asr.go(`app.projects.results`, search_params, { replace: true }))
	})
</script>

<AppScreen>
	<h1>Projects</h1>

	<div class="search_options">
		<fieldset>
			<legend>Document</legend>
			{#each project_documents as document (document.project_document_id)}
				<label>
					<input type="checkbox" bind:group={selected_project_document_ids} value={document.project_document_id}>
					{document.name}
				</label>
			{/each}
		</fieldset>

		<fieldset>
			<legend>Status</legend>
			<label>
				<input type="radio" bind:group={open_or_closed} value="open">
				Open
			</label>
			<label>
				<input type="radio" bind:group={open_or_closed} value="closed">
				Closed
			</label>
		</fieldset>

		<fieldset>
			<legend>Approval</legend>
			<label>
				<input type="checkbox" bind:checked={needs_client_approval}>
				Needs client approval
			</label>
		</fieldset>
	</div>

	<div class="results" data-loading-new-results={loading_new_results}>
		<div class="results">
			<uiView></uiView>
		</div>
	</div>
</AppScreen>

<style>
	.search_options {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--gap_unit);
	}

	fieldset {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--gap_half);
		border: 1px solid var(--generic_border_color);
		border-radius: var(--default_border_radius);
	}

	.results[data-loading-new-results=true] {
		display: none;
	}
</style>
