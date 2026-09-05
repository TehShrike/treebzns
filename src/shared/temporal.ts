import { Temporal } from '@js-temporal/polyfill'
import { reduce } from '#shared/array.ts'

export const later_instant = (a: Temporal.Instant | null, b: Temporal.Instant | null): Temporal.Instant | null => {
	if (a === null) return b
	if (b === null) return a
	return Temporal.Instant.compare(a, b) >= 0 ? a : b
}

export const latest_instant = (...instants: (Temporal.Instant | null)[]): Temporal.Instant | null =>
	reduce(instants, null as Temporal.Instant | null, later_instant)

export const instants_are_equal = (a: Temporal.Instant | null, b: Temporal.Instant | null): boolean =>
	a === null || b === null ? a === b : Temporal.Instant.compare(a, b) === 0
