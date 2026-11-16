<script lang="ts">
	import error_message from '#lib/error_message.ts'

	const { error }: { error: unknown } = $props()
</script>

{#if error !== null && error !== undefined}
	<p class="error" role="alert">{error_message(error)}</p>
{/if}

<style>
	.error {
		margin: 0;
		color: var(--attention_red);
	}
</style>
