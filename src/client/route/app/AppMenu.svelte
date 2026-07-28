<script lang="ts">
	const { asr }: { asr: StateAsr } = $props()
</script>

<nav class="app-menu">
	<div class="logo">🌳</div>
	<ul class="menu-items">
		<li><a class="menu-item" href={asr.makePath('app.home')} data-active={asr.stateIsActive('app.home')}>Home</a></li>
		<li><a class="menu-item" href={asr.makePath('app.create_a_lead')} data-active={asr.stateIsActive('app.create_a_lead')}>Create A Lead</a></li>
		<li><a class="menu-item" href={asr.makePath('app.clients')} data-active={asr.stateIsActive('app.clients')}>Clients</a></li>
	</ul>
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

	.menu-items {
		list-style: none;
		margin: 0;
		padding: 0;
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
		background: var(--friendly_color);
		color: var(--white);
	}
</style>
