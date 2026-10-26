export type PendingAdd<ADDED, ADD_RESULT = bigint> = {
	adding: true,
	values: ADDED,
	commit: (result: ADD_RESULT) => void,
	discard: () => void
}
export type PendingChange<CHANGED, CHANGE_RESULT = void> = {
	adding: false,
	values: CHANGED,
	commit: (result: CHANGE_RESULT) => void,
	discard: () => void
}

export type PendingSave<ADDED, CHANGED, ADD_RESULT = bigint, CHANGE_RESULT = void> =
	PendingAdd<ADDED, ADD_RESULT>
	| PendingChange<CHANGED, CHANGE_RESULT>
