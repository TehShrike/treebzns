import type { AsrStateSnapshot, AsrTransitionState } from '#lib/asr_transition_state.svelte.ts'
import type { StateName, StateParamsByName } from '#lib/state_names.ts'
import { create_asr_last_state } from '#lib/asr_last_state.ts'

export type LastEstimateState = {
	readonly name: StateName | null
	readonly go_back: <NAME extends StateName>(asr: StateAsr, default_state: { name: NAME, params: StateParamsByName[NAME] }) => void
}

const last_state_in_estimate = create_asr_last_state<AsrStateSnapshot>(({ name }) => name.startsWith(`app.estimate.`))

export const last_estimate_state = (transition_state: AsrTransitionState): LastEstimateState => {
	const last_state = last_state_in_estimate(transition_state)

	return {
		name: last_state?.name ?? null,
		go_back: (asr, default_state) => {
			if (last_state === null || last_state.name === default_state.name) {
				asr.go(default_state.name, default_state.params, { replace: true })
			} else {
				asr.go(last_state.name, last_state.parameters as never, { replace: true })
			}
		},
	}
}
