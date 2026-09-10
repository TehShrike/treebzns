<script module lang="ts">
	import type { ClientCache } from '#client/lib/client_cache.svelte.ts'
	import type { SearchSelection } from './client_search_selection.ts'
	import FormLayout from './FormLayout.svelte'
	import ClientNameSearch from './ClientNameSearch.svelte'
	import ClientPhoneSearch from './ClientPhoneSearch.svelte'
</script>

<script lang="ts">
	let { client_cache, on_pick }: {
		client_cache: ClientCache
		on_pick: (selection: SearchSelection) => void
	} = $props()
</script>

<fieldset>
	<legend>Client Search</legend>
	<FormLayout>
		<label>
			Name
			<ClientNameSearch {client_cache} {on_pick} />
		</label>
		<label>
			Phone
			<ClientPhoneSearch {client_cache} {on_pick} />
		</label>
	</FormLayout>
</fieldset>
