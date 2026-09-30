// Which leads the photo export covers: the ones with current work.
// That is every work order that is not Finished, every estimate that is Draft / Unsent or
// Contact the client, and Sent for approval estimates created in the last 30 days. The
// estimate list has no update date, so the Sent for approval cutoff uses date_created.
import assert from 'node:assert/strict'
import { filter, map } from '#shared/array.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarWorkOrder } from '#arbostar_export/workorders.d.ts'

export const SENT_FOR_APPROVAL_DAYS = 30
const FINISHED_WORK_ORDER_STATUS_ID = 0
const ALWAYS_ACTIVE_ESTIMATE_STATUS_IDS = new Set([1, 7])
const SENT_FOR_APPROVAL_STATUS_ID = 2

const local_iso_date = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const iso_from_us_date = (us_date: string) => {
	const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(us_date)
	assert(match, `estimate date_created is MM/DD/YYYY — got ${us_date}`)
	return `${match[3]}-${match[1]}-${match[2]}`
}

export const leads_to_download_images_for = (estimates: ArbostarEstimate[], workorders: ArbostarWorkOrder[], now: Date) => {
	const cutoff_date = new Date(now)
	cutoff_date.setDate(cutoff_date.getDate() - SENT_FOR_APPROVAL_DAYS)
	const cutoff = local_iso_date(cutoff_date)

	const active_workorders = filter(workorders, workorder => workorder.wo_status_id !== FINISHED_WORK_ORDER_STATUS_ID)
	const always_active_estimates = filter(estimates, estimate => ALWAYS_ACTIVE_ESTIMATE_STATUS_IDS.has(estimate.status_id))
	const recent_sent_estimates = filter(
		estimates,
		estimate => estimate.status_id === SENT_FOR_APPROVAL_STATUS_ID && iso_from_us_date(estimate.date_created) >= cutoff,
	)
	const lead_ids = [
		...new Set([
			...map(active_workorders, workorder => workorder.lead_id),
			...map(always_active_estimates, estimate => estimate.lead_id),
			...map(recent_sent_estimates, estimate => estimate.lead_id),
		]),
	]
	return {
		lead_ids,
		description: `${active_workorders.length} active work orders, ${always_active_estimates.length} Draft / Unsent or Contact the client estimates, ${recent_sent_estimates.length} Sent for approval estimates created on or after ${cutoff}: ${lead_ids.length} leads`,
	}
}
