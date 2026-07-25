import type { GoOptions } from 'abstract-state-router'
import type { StateName, StateParamsByName } from './state_names.ts'

declare global {
	type StateAsr = {
		go<NAME extends StateName>(state_name: NAME | null, state_parameters?: StateParamsByName[NAME], options?: GoOptions): void
		stateIsActive<NAME extends StateName>(state_name?: NAME | null, state_parameters?: StateParamsByName[NAME] | null): boolean
		makePath<NAME extends StateName>(state_name: NAME | null, state_parameters?: StateParamsByName[NAME], options?: { inherit?: boolean }): string
		getActiveState(): { name: StateName, parameters: Record<string, string | null> }
	}
}
