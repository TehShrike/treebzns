import assert from '#shared/assert.ts'

type TransitionState<STATE> = {
	readonly current_state: STATE
	readonly state_being_transitioned_to: STATE | null
}

export const create_asr_last_state = <STATE extends { name: string }>(is_in_scope: (state: STATE) => boolean) => {
	const last_states = new Map<string, STATE>()

	return ({ current_state, state_being_transitioned_to }: TransitionState<STATE>): STATE | null => {
		assert(state_being_transitioned_to, `a resolve runs while the router transitions to a state`)
		const this_state_name = state_being_transitioned_to.name

		const went_back = last_states.get(current_state.name)?.name === this_state_name
		if (!went_back) {
			if (is_in_scope(current_state)) {
				last_states.set(this_state_name, current_state)
			} else {
				last_states.delete(this_state_name)
			}
		}

		return last_states.get(this_state_name) ?? null
	}
}
