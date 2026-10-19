<script lang="ts">
	import RightChevron from '#component/RightChevron.svelte'

	const { href, label }: {
		href: string
		label: string
	} = $props()
</script>

<a {href} aria-label={label} title={label}>
	<RightChevron />
</a>

<style>
	a {
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
