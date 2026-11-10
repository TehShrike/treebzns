<script lang="ts">
	import RightChevronIcon from '#component/icon/RightChevronIcon.svelte'

	const { href, label }: {
		href: string
		label: string
	} = $props()
</script>

<a {href} aria-label={label} title={label}>
	<RightChevronIcon />
</a>

<style>
	a {
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
