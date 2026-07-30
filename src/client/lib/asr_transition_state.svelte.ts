import type { AbstractStateRouter } from 'abstract-state-router'
import type { StateName } from './state_names.ts'

export type AsrStateSnapshot = {
	name: StateName
	parameters: { [key: string]: string | string[] | null }
}

type Transition = {
	currently_transitioning: true
	state_being_transitioned_to: AsrStateSnapshot
} | {
	currently_transitioning: false
	state_being_transitioned_to: null
}

export type AsrTransitionState = {
	readonly current_state: AsrStateSnapshot
} & ({
	readonly currently_transitioning: true
	readonly state_being_transitioned_to: AsrStateSnapshot
} | {
	readonly currently_transitioning: false
	readonly state_being_transitioned_to: null
})

const to_snapshot = (name: string, parameters: object): AsrStateSnapshot => ({
	name: name as StateName,
	parameters: parameters as AsrStateSnapshot[`parameters`],
})

export const asr_transition_state = <TEMPLATE, DOM_API>(state_router: AbstractStateRouter<TEMPLATE, DOM_API>): AsrTransitionState => {
	const active = state_router.getActiveState()

	let current_state = $state<AsrStateSnapshot>(to_snapshot(active.name, active.parameters))
	let transition = $state<Transition>({
		currently_transitioning: false,
		state_being_transitioned_to: null,
	})

	state_router.on(`stateChangeStart`, (state, parameters) => {
		transition = {
			currently_transitioning: true,
			state_being_transitioned_to: to_snapshot(state.name, parameters),
		}
	})

	const transition_over = () => {
		transition = {
			currently_transitioning: false,
			state_being_transitioned_to: null,
		}
	}

	state_router.on(`stateChangeEnd`, (state, parameters) => {
		current_state = to_snapshot(state.name, parameters)
		transition_over()
	})

	state_router.on(`stateChangeError`, transition_over)
	state_router.on(`stateChangeCancelled`, transition_over)
	state_router.on(`stateError`, transition_over)

	return {
		get current_state() {
			return current_state
		},
		get currently_transitioning() {
			return transition.currently_transitioning
		},
		get state_being_transitioned_to() {
			return transition.state_being_transitioned_to
		},
	} as AsrTransitionState
}
