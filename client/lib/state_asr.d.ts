import type { AbstractStateRouter } from 'abstract-state-router'
import type { Component } from 'svelte'
import type create_renderer from 'svelte-state-renderer'

// The DOM API the router works with is whatever svelte-state-renderer's `render` returns
// (its `RenderedComponent`), derived from the exported renderer factory so it stays in sync.
type SvelteStateRendererDomApi = ReturnType<ReturnType<ReturnType<typeof create_renderer>>['render']>

declare global {
	type StateAsr = Pick<
		AbstractStateRouter<Component, SvelteStateRendererDomApi>,
		'makePath' | 'stateIsActive' | 'go' | 'getActiveState'
	>
}
