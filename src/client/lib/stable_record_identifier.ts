export const stable_record_identifier = Symbol(`stable record identifier`)

export type WithStableRecordIdentifier<VALUES> = VALUES & { [stable_record_identifier]: string }
