import assert from '#shared/assert.ts'
import { filter, flat_map, for_each, map } from '#shared/array.ts'
import { fetch_offset_pages, request_json } from './api.ts'
import { write_output } from './output.ts'

const earliest_date = '2000-01-01'
const latest_date = '2099-12-31'

type Id = { id: number }

type Estimate = Id & { client: { client_id: number } }
type Invoice = Id & { payments: Id[] }
type Payment = Id & { projects: (Id & { estimate: Id & { number: string } | null; invoice: Id & { number: string } | null })[] }
type Task = { task_id: number }
type TaskDays = Record<string, { users: Record<string, { user_id: number; tasks: Record<string, Task> }> }>

const by_id = (row: Id) => row.id

const reference = (entity: Id & { number: string } | null) => entity && { id: entity.id, number: entity.number }

const datasets: Record<string, () => Promise<Record<string, readonly unknown[]>>> = {
	clients: async () => ({
		clients: await fetch_offset_pages<Id>({ label: 'clients', path: '/api/v1/clients', page_size: 1000, id_of: by_id }),
	}),
	leads: async () => ({
		leads: await fetch_offset_pages<Id>({
			label: 'leads',
			path: '/api/v1/leads',
			page_size: 100,
			params: {
				sort_by: 'lead_id',
				sort_direction: 'asc',
				include_relations: ['utm', 'address', 'tags', 'client', 'estimator', 'status', 'estimate', 'contact'],
			},
			id_of: by_id,
		}),
	}),
	estimates: async () => {
		const estimates = await fetch_offset_pages<Estimate>({ label: 'estimates', path: '/api/v1/estimates', page_size: 200, id_of: by_id })
		const client_records = new Map(map(estimates, estimate => [estimate.client.client_id, estimate.client]))
		return {
			estimates: map(estimates, ({ client, ...estimate }) => ({ ...estimate, client_id: client.client_id })),
			client_records: [...client_records.values()],
		}
	},
	invoices: async () => {
		const invoices = await fetch_offset_pages<Invoice>({ label: 'invoices', path: '/api/v1/invoices', page_size: 10, id_of: by_id })
		return {
			invoices: map(invoices, ({ payments, ...invoice }) => ({ ...invoice, payment_ids: map(payments, by_id) })),
		}
	},
	payments: async () => {
		const payments = await fetch_offset_pages<Payment>({ label: 'payments', path: '/api/v1/payments', page_size: 100, id_of: by_id })
		return {
			payments: map(payments, payment => ({
				...payment,
				projects: map(payment.projects, project => ({
					...project,
					estimate: reference(project.estimate),
					invoice: reference(project.invoice),
				})),
			})),
		}
	},
	workorders: async () => ({
		workorders: await fetch_offset_pages<Id>({
			label: 'workorders',
			path: '/api/v1/workorders',
			page_size: 100,
			params: { sort_by: 'id', sort_direction: 'asc' },
			id_of: by_id,
		}),
	}),
	users: async () => ({
		users: await fetch_offset_pages<Id>({
			label: 'users',
			path: '/api/v1/trackers',
			page_size: 10,
			params: { dateFrom: earliest_date, dateTo: latest_date },
			id_of: by_id,
		}),
	}),
	items: async () => ({
		items: await fetch_offset_pages<Id>({ label: 'items', path: '/api/v1/items', page_size: 1000, id_of: by_id }),
		categories: await fetch_offset_pages<Id>({ label: 'categories', path: '/api/v1/categories', page_size: 1000, id_of: by_id }),
	}),
	brands: async () => ({
		brands: (await request_json<{ data: unknown[] }>('GET', '/api/brands')).data,
	}),
	requests: async () => ({
		requests: await fetch_offset_pages<Id>({ label: 'requests', path: '/api/v1/requests', page_size: 1000, id_of: by_id }),
	}),
	schedule_events: async () => ({
		schedule_events: await fetch_offset_pages<Id>({
			label: 'schedule_events',
			method: 'POST',
			path: '/api/schedule/event',
			page_size: 100,
			params: { dateFrom: earliest_date, dateTo: latest_date },
			id_of: by_id,
		}),
	}),
	tasks: async () => {
		const response = await request_json<{ data: TaskDays | [], meta: { total: number } }>('POST', '/api/tasks', { start_date: earliest_date, end_date: latest_date })
		const tasks = flat_map(Object.values(response.data), day =>
			flat_map(Object.values(day.users), user =>
				map(Object.values(user.tasks), task => ({ ...task, user_id: user.user_id }))))
		assert(tasks.length === response.meta.total, `/api/tasks returns ${response.meta.total} tasks — got ${tasks.length}`)
		const categories = await request_json<{ data: unknown[] }>('GET', '/api/tasks/categories')
		return {
			tasks,
			task_categories: categories.data,
		}
	},
}

const requested = process.argv.slice(2)
const unknown_names = filter(requested, name => !(name in datasets))
assert(unknown_names.length === 0, `every requested dataset exists — unknown: ${unknown_names.join(', ')}. Known: ${Object.keys(datasets).join(', ')}`)
const names = requested.length > 0 ? requested : Object.keys(datasets)

const results = await Promise.all(map(names, async name => {
	try {
		const files = await datasets[name]!()
		for_each(Object.entries(files), ([file_name, rows]) => {
			console.log(`[${name}] wrote ${rows.length} rows to ${write_output(file_name, rows)}`)
		})
		return { name, ok: true }
	} catch (error) {
		console.error(`[${name}] failed:`, error)
		return { name, ok: false }
	}
}))

const failed = filter(results, result => !result.ok)
if (failed.length > 0) {
	console.error(`Failed: ${map(failed, result => result.name).join(', ')}`)
	process.exit(1)
}
