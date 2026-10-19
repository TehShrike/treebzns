<script module lang="ts">
	import { state_type } from '#lib/client_type.ts'
	import AppScreen from '#component/AppScreen.svelte'

	export const asr_state = state_type({
		name: `app.menu.projects`,
		route: `/projects`,
		default_child: `lead`,
	})

	const tabs = [
		{ state_name: `app.menu.projects.lead`, label: `Lead` },
		{ state_name: `app.menu.projects.proposal`, label: `Proposal` },
	] as const
</script>

<script lang="ts">
	const { asr }: { asr: StateAsr } = $props()
</script>

<AppScreen>
	<h1>Projects</h1>

	<div class="tab_control">
		<menu role="tablist">
			{#each tabs as tab (tab.state_name)}
				<li role="tab" aria-selected={asr.stateIsActive(tab.state_name)}>
					<a href={asr.makePath(tab.state_name)}>{tab.label}</a>
				</li>
			{/each}
		</menu>
		<div class="window" role="tabpanel">
			<div class="window-body">
				<uiView></uiView>
			</div>
		</div>
	</div>
</AppScreen>

<style>
	.tab_control {
		display: flex;
		flex-direction: column;
	}
</style>
