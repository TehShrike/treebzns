<script module lang="ts">
	import { state_type } from '#client/lib/state_type.ts'

	export const asr_state = state_type({
		name: `login`,
		route: `/login`,
	})
</script>

<script lang="ts">
	import f3tch from '#shared/f3tch.ts'

	let { message }: { message?: string } = $props()

	let email = $state(``)
	let password = $state(``)
	let result = $state<{ type: 'success' | 'error'; text: string } | null>(null)

	const submit = async (e: SubmitEvent) => {
		e.preventDefault()
		try {
			await f3tch(`/api/log_in`, {
				method: `POST`,
				body: { email, password },
			})
			result = { type: `success`, text: `Logged in!` }
		} catch (err: any) {
			const message = err?.body?.message ?? err?.message ?? `Something went wrong`
			result = { type: `error`, text: `Error: ${message}` }
		}
	}
</script>

<div class="login">
	<h1>Log in</h1>
	{#if message}<p>{message}</p>{/if}
	<form onsubmit={submit}>
		<label>Email
			<input type="email" bind:value={email} required>
		</label>
		<label>Password
			<input type="password" bind:value={password} required>
		</label>
		<button type="submit">Log in</button>
	</form>
	{#if result}
		<div class="result {result.type}">{result.text}</div>
	{/if}
</div>

<style>
	.login {
		font-family: sans-serif;
		max-width: 480px;
		margin: 4rem auto;
		padding: 0 1rem;
	}

	label {
		display: block;
		margin-top: 0.75rem;
		font-size: 0.9rem;
	}

	input {
		display: block;
		width: 100%;
		box-sizing: border-box;
		margin-top: 0.25rem;
		padding: 0.4rem 0.5rem;
		font-size: 1rem;
	}

	button {
		margin-top: 1.5rem;
		padding: 0.6rem 1.4rem;
		font-size: 1rem;
		cursor: pointer;
	}

	.result {
		margin-top: 1rem;
		padding: 0.75rem;
		border-radius: 4px;
	}

	.result.success {
		background: #d4edda;
		color: #155724;
	}

	.result.error {
		background: #f8d7da;
		color: #721c24;
	}
</style>
