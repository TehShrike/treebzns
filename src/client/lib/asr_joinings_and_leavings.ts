import type { StateChangeEvent } from 'abstract-state-router'
import make_emitter, { type Emitter } from 'better-emitter'
import { filter, for_each, map } from '#shared/array.ts'

export type StateEventName = `left ${string}` | `joined ${string}`

type StateEvents<CONTEXT> = Record<StateEventName, { context: CONTEXT }>

export type AsrJoiningsAndLeavings<CONTEXT> = Pick<Emitter<StateEvents<CONTEXT>>, 'on' | 'once'>

type StateRouterEvents = {
	on(event: StateChangeEvent, callback: (state: { name: string }) => void): void
	getActiveState(): { name: string }
}

export const state_hierarchy = (state_name: string): string[] => {
	if (state_name === ``) return []
	const parts = state_name.split(`.`)
	return map(parts, (_, index) => parts.slice(0, index + 1).join(`.`))
}

const not_in = (hierarchy: string[]) => {
	const names = new Set(hierarchy)
	return (state_name: string) => !names.has(state_name)
}

export const create_asr_joinings_and_leavings = <CONTEXT>(
	state_router: StateRouterEvents,
	get_context: () => CONTEXT,
): AsrJoiningsAndLeavings<CONTEXT> => {
	const emitter = make_emitter<StateEvents<CONTEXT>>()
	let current_hierarchy = state_hierarchy(state_router.getActiveState().name)

	const emit = (event: StateEventName) => emitter.emit(event, { context: get_context() })

	state_router.on(`stateChangeStart`, state => {
		const left = filter(current_hierarchy, not_in(state_hierarchy(state.name))).reverse()
		for_each(left, state_name => emit(`left ${ state_name }`))
	})

	state_router.on(`stateChangeEnd`, state => {
		const next_hierarchy = state_hierarchy(state.name)
		const joined = filter(next_hierarchy, not_in(current_hierarchy))
		current_hierarchy = next_hierarchy
		for_each(joined, state_name => emit(`joined ${ state_name }`))
	})

	return { on: emitter.on, once: emitter.once }
}
