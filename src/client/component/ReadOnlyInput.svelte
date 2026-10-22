<script lang="ts">
	const { value, aria_label = null }: {
		value: string
		aria_label?: string | null
	} = $props()

	const select_all = (event: { currentTarget: HTMLInputElement }) => { event.currentTarget.select() }
</script>

<input type="text" readonly {value} aria-label={aria_label} onfocus={select_all} onclick={select_all}>
