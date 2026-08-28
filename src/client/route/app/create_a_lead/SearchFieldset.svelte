<script module lang="ts">
	import type { ClientCache, CachedClient, CachedClientContact } from '#client/lib/client_cache.svelte.ts'
	import FormLayout from '#client/component/FormLayout.svelte'
	import ClientNameSearch, { type NameSearchOption, type NameSearchSelection } from '#client/component/ClientNameSearch.svelte'
	import ClientPhoneSearch, { type PhoneSearchOption, type PhoneSearchSelection } from '#client/component/ClientPhoneSearch.svelte'

	export type SearchSelection = {
		client: CachedClient['client']
		contact: CachedClientContact | null
	}
</script>

<script lang="ts">
	let { client_cache, name_option = $bindable(null), phone_option = $bindable(null), onpick }: {
		client_cache: ClientCache
		value?: NameSearchOption | null
		onpick: (selection: SearchSelection) => void
	} = $props()

	const on_name_change = (selection: NameSearchSelection | null) => {
		if (selection) {
			phone_option = null
			onpick(selection)
		}
	}

	const on_phone_change = (selection: PhoneSearchSelection | null) => {
		if (selection) {
			name_option = null
			onpick(selection)
		}
	}
</script>

<fieldset>
	<legend>Search</legend>
	<FormLayout>
		<label>
			Name
			<ClientNameSearch {client_cache} bind:selected_option={name_option} onchange={on_name_change} />
		</label>
		<label>
			Phone
			<ClientPhoneSearch {client_cache} bind:selected_option={phone_option} onchange={on_phone_change} />
		</label>
	</FormLayout>
</fieldset>
