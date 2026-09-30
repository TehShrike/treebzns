import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { leads_to_download_images_for } from './leads_to_download_images_for.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarWorkOrder } from '#arbostar_export/workorders.d.ts'

const estimate = (lead_id: number, status_id: number, date_created: string) =>
	({ lead_id, status_id, date_created }) as ArbostarEstimate
const workorder = (lead_id: number, wo_status_id: number) => ({ lead_id, wo_status_id }) as ArbostarWorkOrder

test(`leads_to_download_images_for keeps unfinished work orders, draft estimates, and recent sent estimates`, () => {
	const now = new Date(2026, 8, 30)
	const { lead_ids } = leads_to_download_images_for(
		[
			estimate(1, 1, `01/01/2020`),
			estimate(2, 7, `01/01/2020`),
			estimate(3, 2, `08/31/2026`),
			estimate(4, 2, `08/30/2026`),
			estimate(5, 3, `09/29/2026`),
		],
		[workorder(6, 5), workorder(7, 0), workorder(1, 5)],
		now,
	)
	assert.deepEqual([...lead_ids].sort(), [1, 2, 3, 6])
})
