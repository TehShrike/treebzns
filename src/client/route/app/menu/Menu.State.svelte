<script module lang="ts">
	import { state_type } from '#client/lib/client_type.ts'

	export const asr_state = state_type({
		name: `app.menu`,
		route: ``,
		default_child: 'home',
	})
</script>

<script lang="ts">
	import AppMenu from './AppMenu.svelte'

	let { asr }: { asr: StateAsr } = $props()
</script>

<div class="menu-layout">
	<AppMenu {asr} />
	<uiView></uiView>
</div>

<style>
	.menu-layout {
		display: flex;
		flex-direction: row;
		flex-grow: 1;
	}

	uiView {
		flex-grow: 1;
	}
</style>
