import type { Pool } from 'mysql2/promise'
import type { ArbostarApiScheduleEvent } from '#arbostar_api_export/schedule_events.d.ts'
import { pool_transaction } from '#shared/mysql/helpers.ts'
import make_write_helper from '#shared/mysql/write_helper.ts'
import assert from '#shared/assert.ts'
import { map, filter, filter_map, flat_map, for_each } from '#shared/array.ts'
import { promise_all_object } from '#shared/promise_all_object.ts'
import { ROWS_PER_BATCH, make_tenanted_select, normalize_name } from './import_common.ts'
import { instant_from_unix_seconds } from './arbostar_dates.ts'

const unassigned_crew_name = 'Unassigned'

const crew_name = (event: ArbostarApiScheduleEvent): string => event.crew.leader.trim() || unassigned_crew_name

const project_number = (event: ArbostarApiScheduleEvent): number => {
	const match = /^0*(\d+)-W$/.exec(event.workorder_number)
	assert(match, `schedule event ${event.id} has a parseable work order number – found "${event.workorder_number}"`)
	return Number(match[1])
}

const unique_key = (project_id: bigint, crew_id: bigint, work_date: { toString: () => string }) =>
	`${project_id}:${crew_id}:${work_date.toString()}`

export const import_schedule_events = async ({
	pool,
	company_id,
	schedule_events,
}: {
	pool: Pool
	company_id: bigint
	schedule_events: ArbostarApiScheduleEvent[]
}) => {
	const tenanted_select = make_tenanted_select(company_id)

	const { company_rows, crew_rows, employee_rows, project_rows, line_item_rows, project_crew_rows } = await promise_all_object({
		company_rows: tenanted_select(pool, q => q
			.from('company')
			.select(() => ['company.timezone'])),
		crew_rows: tenanted_select(pool, q => q
			.from('crew')
			.select(() => ['crew.crew_id', 'crew.name'])),
		employee_rows: tenanted_select(pool, q => q
			.from('employee')
			.select(() => ['employee.employee_id', 'employee.name'])),
		project_rows: tenanted_select(pool, q => q
			.from('project')
			.select(() => ['project.project_id', 'project.number'])),
		line_item_rows: tenanted_select(pool, q => q
			.from('project_line_item')
			.select(() => ['project_line_item.project_line_item_id', 'project_line_item.project_id', 'project_line_item.arbostar_line_item_id'])),
		project_crew_rows: tenanted_select(pool, q => q
			.from('project_crew')
			.select(() => [
				'project_crew.project_crew_id',
				'project_crew.project_id',
				'project_crew.crew_id',
				'project_crew.work_date',
				'project_crew.arbostar_schedule_event_id',
			])),
	})

	assert(company_rows.length === 1, `company ${company_id} exists`)
	const timezone = company_rows[0]!.company.timezone

	const project_id_by_number = new Map(map(project_rows, row => [Number(row.project.number), row.project.project_id] as const))
	const employee_id_by_name = new Map(map(employee_rows, row => [normalize_name(row.employee.name), row.employee.employee_id] as const))
	const line_item_by_arbostar_id = new Map(map(
		filter(line_item_rows, row => row.project_line_item.arbostar_line_item_id !== null),
		row => [Number(row.project_line_item.arbostar_line_item_id), row.project_line_item] as const,
	))

	const importable = filter(schedule_events, event => project_id_by_number.has(project_number(event)))

	return pool_transaction(pool, async connection => {
		const write_helper = make_write_helper({ connection, company_id })

		const crew_id_by_name = new Map(map(crew_rows, row => [normalize_name(row.crew.name), row.crew.crew_id] as const))
		const new_crew_names = [...new Map(map(
			filter(importable, event => !crew_id_by_name.has(normalize_name(crew_name(event)))),
			event => [normalize_name(crew_name(event)), crew_name(event)] as const,
		)).entries()]
		if (new_crew_names.length > 0) {
			const { insert_ids } = await write_helper.bulk_insert(
				'crew',
				map(new_crew_names, ([, name]) => ({ name, color: '#000000' })),
				ROWS_PER_BATCH,
			)
			new_crew_names.forEach(([normalized_name], index) => crew_id_by_name.set(normalized_name, insert_ids[index]!))
		}

		const visits = map(importable, event => {
			const start = instant_from_unix_seconds(event.event_start).toZonedDateTimeISO(timezone)
			return {
				event,
				project_id: project_id_by_number.get(project_number(event))!,
				crew_id: crew_id_by_name.get(normalize_name(crew_name(event)))!,
				work_date: start.toPlainDate(),
				start_time: start.toPlainTime(),
			}
		})

		const visit_keys = map(visits, visit => unique_key(visit.project_id, visit.crew_id, visit.work_date))
		assert(
			new Set(visit_keys).size === visits.length,
			'every schedule event is the only one for its project, crew, and work date',
		)

		const project_crew_id_by_event_id = new Map(map(
			filter(project_crew_rows, row => row.project_crew.arbostar_schedule_event_id !== null),
			row => [Number(row.project_crew.arbostar_schedule_event_id), row.project_crew.project_crew_id] as const,
		))
		const uncorrelated_project_crew_id_by_key = new Map(map(
			filter(project_crew_rows, row => row.project_crew.arbostar_schedule_event_id === null),
			row => [unique_key(row.project_crew.project_id, row.project_crew.crew_id, row.project_crew.work_date), row.project_crew.project_crew_id] as const,
		))

		const adopted_or_correlated_id = (visit: typeof visits[number]) =>
			project_crew_id_by_event_id.get(visit.event.id)
			?? uncorrelated_project_crew_id_by_key.get(unique_key(visit.project_id, visit.crew_id, visit.work_date))

		const existing_visits = filter(visits, visit => adopted_or_correlated_id(visit) !== undefined)
		const new_visits = filter(visits, visit => adopted_or_correlated_id(visit) === undefined)
		const adopted_count = filter(existing_visits, visit => !project_crew_id_by_event_id.has(visit.event.id)).length

		const incoming_event_ids = new Set(map(visits, visit => visit.event.id))
		const stale_project_crew_ids = map(
			filter([...project_crew_id_by_event_id.entries()], ([event_id]) => !incoming_event_ids.has(event_id)),
			([, project_crew_id]) => project_crew_id,
		)

		const project_crew_id_by_visit = new Map(map(existing_visits, visit => [visit, adopted_or_correlated_id(visit)!] as const))
		const child_project_crew_ids = [...project_crew_id_by_visit.values(), ...stale_project_crew_ids]
		await write_helper.delete('project_crew_employee', 'project_crew_id', child_project_crew_ids, ROWS_PER_BATCH)
		await write_helper.delete('project_crew_project_line_item', 'project_crew_id', child_project_crew_ids, ROWS_PER_BATCH)
		await write_helper.delete('project_crew', 'project_crew_id', stale_project_crew_ids, ROWS_PER_BATCH)

		const visit_fields = (visit: typeof visits[number]) => ({
			project_id: visit.project_id,
			crew_id: visit.crew_id,
			work_date: visit.work_date,
			day_order: null,
			start_time: visit.start_time,
			arbostar_schedule_event_id: BigInt(visit.event.id),
		})

		await write_helper.bulk_update(
			'project_crew',
			'project_crew_id',
			map(existing_visits, visit => ({ value: project_crew_id_by_visit.get(visit)!, set: visit_fields(visit) })),
			ROWS_PER_BATCH,
		)
		if (new_visits.length > 0) {
			const { insert_ids } = await write_helper.bulk_insert('project_crew', map(new_visits, visit_fields), ROWS_PER_BATCH)
			new_visits.forEach((visit, index) => project_crew_id_by_visit.set(visit, insert_ids[index]!))
		}

		const leader_rows = filter_map(visits, visit => {
			const employee_id = employee_id_by_name.get(normalize_name(visit.event.crew.leader))
			return employee_id === undefined ? null : { project_crew_id: project_crew_id_by_visit.get(visit)!, employee_id }
		})
		if (leader_rows.length > 0) {
			await write_helper.bulk_insert('project_crew_employee', leader_rows, ROWS_PER_BATCH)
		}

		let line_items_without_project_line_item = 0
		const line_item_rows_to_insert = flat_map(visits, visit => filter_map(visit.event.services, service => {
			const line_item = line_item_by_arbostar_id.get(service.id)
			if (line_item === undefined) {
				line_items_without_project_line_item += 1
				return null
			}
			assert(
				line_item.project_id === visit.project_id,
				`line item ${service.id} on schedule event ${visit.event.id} belongs to the event's project`,
			)
			return { project_crew_id: project_crew_id_by_visit.get(visit)!, project_line_item_id: line_item.project_line_item_id }
		}))
		if (line_item_rows_to_insert.length > 0) {
			await write_helper.bulk_insert('project_crew_project_line_item', line_item_rows_to_insert, ROWS_PER_BATCH)
		}

		const unmatched_leaders = new Set<string>()
		for_each(visits, visit => {
			const leader = visit.event.crew.leader.trim()
			if (leader !== '' && !employee_id_by_name.has(normalize_name(leader))) unmatched_leaders.add(leader)
		})

		return {
			crews_inserted: new_crew_names.length,
			project_crews_inserted: new_visits.length,
			project_crews_updated: existing_visits.length - adopted_count,
			project_crews_adopted_from_app: adopted_count,
			project_crews_deleted_no_longer_in_export: stale_project_crew_ids.length,
			project_crew_employees_inserted: leader_rows.length,
			project_crew_project_line_items_inserted: line_item_rows_to_insert.length,
			skipped_events_without_project: schedule_events.length - importable.length,
			skipped_line_items_without_project_line_item: line_items_without_project_line_item,
			unmatched_leader_names: [...unmatched_leaders].join(', ') || 'none',
		}
	})
}
