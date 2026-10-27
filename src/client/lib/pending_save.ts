export type PendingAdd<ADDED, ADD_RESULT = bigint> = {
	adding: true,
	values: ADDED,
	commit: (result: ADD_RESULT) => void,
	discard: () => void
}

type ChangeCommit<CHANGE_RESULT> = [CHANGE_RESULT] extends [void] ? () => void : (result: CHANGE_RESULT) => void

export type PendingChange<CHANGED, CHANGE_RESULT = void> = {
	adding: false,
	values: CHANGED,
	commit: ChangeCommit<CHANGE_RESULT>,
	discard: () => void
}

export type PendingSave<ADDED, CHANGED, ADD_RESULT = bigint, CHANGE_RESULT = void> =
	PendingAdd<ADDED, ADD_RESULT>
	| PendingChange<CHANGED, CHANGE_RESULT>
