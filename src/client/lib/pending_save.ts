export type PendingAdd<ADDED> = { adding: true, values: ADDED, commit: (db_id: bigint) => void, discard: () => void }
export type PendingChange<CHANGED> = { adding: false, values: CHANGED, commit: (db_id?: bigint | undefined) => void, discard: () => void }

export type PendingSave<ADDED, CHANGED> = PendingAdd<ADDED> | PendingChange<CHANGED>
