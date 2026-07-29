<script module lang="ts">
	import { state_type } from '#client/lib/client_type.ts'
	import redirect_resolve_to from '#client/lib/redirect_resolve_to.ts'

	const redirect_to_state = 'app'

	export const asr_state = state_type({
		name: `login`,
		route: `/login`,
		async resolve({ get_session }) {
			const session = await get_session()

			if (session.logged_in) {
				redirect_resolve_to({ name: redirect_to_state })
			}

			return {}
		}
	})
</script>

<script lang="ts">
	import f3tch from '#shared/f3tch.ts'

	let {
		asr
	}: {
		asr: StateAsr
	} = $props()

	let email_or_login_name = $state(``)
	let password = $state(``)
	let result = $state<{ type: 'success' | 'error'; text: string } | null>(null)

	const submit = async (e: SubmitEvent) => {
		e.preventDefault()
		try {
			await f3tch(`/api/log_in`, {
				method: `POST`,
				body: { email_or_login_name, password },
			})
			result = { type: `success`, text: `Logged in!` }
			asr.go(redirect_to_state)
		} catch (err: any) {
			const message = err?.body?.message ?? err?.message ?? `Something went wrong`
			result = { type: `error`, text: `Error: ${message}` }
		}
	}
</script>

<div class="login">
	<h1>Log in</h1>
	<form onsubmit={submit}>
		<label>Email/login name
			<input type="text" bind:value={email_or_login_name} required>
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
