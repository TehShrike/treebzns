import { Temporal } from '@js-temporal/polyfill'
import assert from '#shared/assert.ts'

const full_iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const midnight_iso = /^(\d{4}-\d{2}-\d{2})T0[56]:00:00(\.0+)?Z$/
const mmddyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/
const yyyymmdd = /^\d{4}-\d{2}-\d{2}$/

export const is_midnight_iso = (iso: string): boolean => midnight_iso.test(iso)

export const instant_from_iso = (iso: string): Temporal.Instant => {
	assert(full_iso.test(iso), `ArboStar instant string "${iso}" is a full ISO UTC instant`)
	assert(!midnight_iso.test(iso), `ArboStar instant string "${iso}" is not a midnight-encoded local date`)
	return Temporal.Instant.from(iso)
}

export const date_from_midnight_iso = (iso: string): Temporal.PlainDate => {
	const match = midnight_iso.exec(iso)
	assert(match, `ArboStar date string "${iso}" is a midnight-encoded ISO string`)
	return Temporal.PlainDate.from(match[1]!)
}

export const date_from_mmddyyyy = (s: string): Temporal.PlainDate => {
	const match = mmddyyyy.exec(s)
	assert(match, `ArboStar date string "${s}" is in MM/DD/YYYY format`)
	return Temporal.PlainDate.from(`${match[3]}-${match[1]}-${match[2]}`)
}

export const date_from_yyyymmdd = (s: string): Temporal.PlainDate => {
	assert(yyyymmdd.test(s), `ArboStar date string "${s}" is in YYYY-MM-DD format`)
	return Temporal.PlainDate.from(s)
}

export const instant_from_unix_seconds = (n: number): Temporal.Instant => {
	assert(Number.isInteger(n), `ArboStar unix timestamp ${n} is an integer count of seconds`)
	return Temporal.Instant.fromEpochMilliseconds(n * 1000)
}
