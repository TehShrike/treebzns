import { Temporal } from '@js-temporal/polyfill'
import { filter, filter_map, map, reduce, find } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import { has_local_midnight_shape } from './arbostar_dates.ts'

// Zones with identical offset histories cannot be told apart by timestamps, so the winner
// comes from this list when possible. Samples from a single DST season also cannot rule out
// a fixed-offset neighbor (summer Chicago looks like year-round fixed UTC−5), so within each
// tier the DST-observing zones come first. Tiers: US, then Canada, then a few majors.
const PREFERRED_ZONES = [
	'America/New_York',
	'America/Chicago',
	'America/Denver',
	'America/Los_Angeles',
	'America/Anchorage',
	'America/Phoenix',
	'Pacific/Honolulu',
	'America/St_Johns',
	'America/Halifax',
	'America/Toronto',
	'America/Winnipeg',
	'America/Edmonton',
	'America/Vancouver',
	'America/Regina',
	'Europe/London',
	'Europe/Berlin',
	'Australia/Sydney',
	'Asia/Tokyo',
]

const is_local_midnight = (instant: Temporal.Instant, zone: string): boolean => {
	const zoned = instant.toZonedDateTimeISO(zone)
	return zoned.equals(zoned.startOfDay())
}

// Backdated leads and every work order carry their created date as local midnight serialized
// to UTC, which embeds the company's UTC offset on that date. Enough of them across both
// solstice seasons pins the zone's standard offset and its daylight-saving rule.
export const derive_timezone_from_export = ({ leads, workorders }: {
	leads: { lead_date_created: string | null }[]
	workorders: { date_created: string | null }[]
}): string => {
	const candidate_strings = [...new Set([
		...filter_map(leads, lead =>
			lead.lead_date_created !== null && has_local_midnight_shape(lead.lead_date_created) ? lead.lead_date_created : null),
		...filter_map(workorders, workorder =>
			workorder.date_created !== null && has_local_midnight_shape(workorder.date_created) ? workorder.date_created : null),
	])]
	const samples = map(candidate_strings, iso => Temporal.Instant.from(iso))
	assert(samples.length > 0, 'the export contains midnight-encoded dates to sample')

	const scored = map([...Intl.supportedValuesOf('timeZone')], zone => ({
		zone,
		mismatches: filter(samples, instant => !is_local_midnight(instant, zone)).length,
	}))
	// A real creation instant lands on an exact hour boundary sometimes, so a few candidate
	// samples are false positives. The winning zone only has to explain most of them.
	const best_score = reduce(scored, Infinity, (best, entry) => Math.min(best, entry.mismatches))
	const clean = samples.length - best_score
	assert(
		clean >= Math.max(2, samples.length * 0.75),
		`an IANA timezone explains most of the ${samples.length} midnight samples – best explains ${clean}`,
	)

	const best_zones = filter_map(scored, entry => (entry.mismatches === best_score ? entry.zone : null))
	const winner = find(PREFERRED_ZONES, zone => best_zones.includes(zone))
	if (winner !== undefined) return winner
	// Zones with identical offset histories parse identically, so any best scorer is correct
	// for parsing. Single-season evidence outside the preferred list may still pick a wrong
	// DST rule — the alphabetically first zone at least makes the pick deterministic.
	return reduce(best_zones, best_zones[0]!, (first, zone) => (zone < first ? zone : first))
}
