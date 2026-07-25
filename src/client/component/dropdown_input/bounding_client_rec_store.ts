import { readable, type Readable } from 'svelte/store'

export type RelevantDomRect = Pick<DOMRect, 'x' | 'y' | 'width' | 'height' | 'top' | 'right' | 'bottom' | 'left'>

export const empty_rect: RelevantDomRect = {
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	top: 0,
	right: 0,
	bottom: 0,
	left: 0,
}

export const dummy: Readable<RelevantDomRect> = readable(Object.freeze({ ...empty_rect }))

export default (node: HTMLElement) => node
	? readable<RelevantDomRect>(node.getBoundingClientRect(), set => {
		const event_listener = () => set(node.getBoundingClientRect())

		window.addEventListener(`scroll`, event_listener)
		window.addEventListener(`resize`, event_listener)

		return () => {
			window.removeEventListener(`scroll`, event_listener)
			window.removeEventListener(`resize`, event_listener)
		}
	})
	: dummy
