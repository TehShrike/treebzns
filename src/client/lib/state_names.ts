import type globbed_states from '../globbed_states.generated.ts'
import type { State } from './client_type.ts'

type GlobbedAsrState = (typeof globbed_states)[number]['export']['asr_state']

export type StateName = GlobbedAsrState['name']

export type StateParamsByName = {
	[STATE in GlobbedAsrState as STATE['name']]: STATE extends State<string, string, infer ALL_PARAMS, object, object>
		? ALL_PARAMS
		: never
}
