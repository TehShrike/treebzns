declare module "svelte-state-renderer" {
	import type { Component } from 'svelte'

	type RenderedComponent = Component & {
		mountedToTarget: Element
	}

	type RenderContext = {
		template: Component
		element: Element
		content: unknown
		parameters: object
	}

	type SvelteRenderer = (asr: unknown) => {
		render(context: RenderContext): RenderedComponent
		destroy(rendered_template_api: RenderedComponent): void
		getChildElement(rendered_template_api: RenderedComponent): RenderedComponent
	}

	function create_renderer(default_parameters?: object): SvelteRenderer

	export default create_renderer
}
