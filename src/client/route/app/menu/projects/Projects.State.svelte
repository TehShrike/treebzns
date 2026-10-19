<script module lang="ts">
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { StateParamsByName } from '#lib/state_names.ts'
	import AppScreen from '#component/AppScreen.svelte'
	import { select_project_documents } from '#lib/generic_queries/project_document.ts'
	import { untrack } from 'svelte'
	import { validate_project_search_params } from './project_search_params.ts'

	export const asr_state = state_type({
		name: `app.menu.projects`,
		route: `/projects`,
		default_child: `results`,
		param_validator: validate_project_search_params,
		resolve: async ({ query, transition_state }, params) => {
			return {
				transition_state,
				project_documents: await select_project_documents(query),
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
		&& (transition_state.state_being_transitioned_to.name === `app.menu.projects`
			|| transition_state.state_being_transitioned_to.name.startsWith(`app.menu.projects.`))
	)

	// svelte-ignore state_referenced_locally
	let selected_project_document_ids = $state([...initial_search.project_document_ids])
	// svelte-ignore state_referenced_locally
	let open_or_closed = $state(initial_search.open_or_closed)
	// svelte-ignore state_referenced_locally
	let needs_client_approval = $state(initial_search.needs_client_approval)

	$effect(() => {
		const search_params: StateParamsByName[`app.menu.projects.results`] = {}
		if (selected_project_document_ids.length > 0) {
			search_params.project_document_ids = selected_project_document_ids
		}
		if (open_or_closed === `closed`) {
			search_params.open_or_closed = `closed`
		}
		if (needs_client_approval) {
			search_params.needs_client_approval = true
		}
		untrack(() => asr.go(`app.menu.projects.results`, search_params, { replace: true }))
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
				<input type="radio" name="open_or_closed" bind:group={open_or_closed} value="open">
				Open
			</label>
			<label>
				<input type="radio" name="open_or_closed" bind:group={open_or_closed} value="closed">
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
