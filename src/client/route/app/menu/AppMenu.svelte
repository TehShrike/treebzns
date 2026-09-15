<script lang="ts">
	import f3tch from '#shared/f3tch.ts'

	const { asr }: { asr: StateAsr } = $props()

	const log_out = async () => {
		await f3tch(`/api/log_out`, { method: `POST` })
		window.location.href = `/app`
	}
</script>

<nav class="app-menu">
	<div class="logo">🌳</div>
	<a class="menu-item" href={asr.makePath('app.menu.home')} data-active={asr.stateIsActive('app.menu.home')}>Home</a>
	<a class="menu-item" href={asr.makePath('app.menu.create_a_lead')} data-active={asr.stateIsActive('app.menu.create_a_lead')}>Create A Lead</a>
	<a class="menu-item" href={asr.makePath('app.menu.clients')} data-active={asr.stateIsActive('app.menu.clients')}>Clients</a>
	<a class="menu-item" href={asr.makePath('app.menu.projects')} data-active={asr.stateIsActive('app.menu.projects')}>Projects</a>
	<a class="menu-item" href={asr.makePath('app.menu.leads_to_estimate')} data-active={asr.stateIsActive('app.menu.leads_to_estimate')}>Leads To Estimate</a>
	<div class="log-out-container">
		<button type="button" onclick={log_out}>Log out</button>
	</div>
</nav>

<style>
	.app-menu {
		display: flex;
		flex-direction: column;
		width: 220px;
		flex-shrink: 0;
		background: #f4f4f4;
		border-right: 1px solid #ddd;
	}

	.logo {
		text-align: center;
		font-size: 2.5rem;
		padding: 1rem 0;
	}

	.menu-item {
		display: block;
		padding: 0.75rem 1.25rem;
		font-size: 1rem;
		color: inherit;
		text-decoration: none;
		cursor: pointer;
	}

	.menu-item:hover {
		background: #e4e4e4;
	}

	.menu-item[data-active='true'] {
		background: var(--primary_color_dark);
		color: var(--white);
	}

	.log-out-container {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		padding: 1rem 1.25rem;
	}

	@media (max-width: 800px) {
		.app-menu {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			width: auto;
			border-right: none;
			border-bottom: 1px solid #ddd;
		}

		.logo {
			font-size: 1.5rem;
			padding: 0 0.5rem;
		}

		.menu-item {
			padding: 0.375rem 0.625rem;
			font-size: 0.875rem;
		}

		.log-out-container {
			margin-top: 0;
			margin-left: auto;
			padding: 0.25rem 0.5rem;
		}
	}
</style>
