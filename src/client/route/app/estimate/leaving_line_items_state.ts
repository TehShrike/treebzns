import type { AsrTransitionState } from '#lib/asr_transition_state.svelte.ts'

export const leaving_line_items_state = ({ current_state }: AsrTransitionState): boolean => current_state.name === `app.estimate.line_items`
