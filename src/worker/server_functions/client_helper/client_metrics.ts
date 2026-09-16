import { Temporal } from '@js-temporal/polyfill'
import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'
import is_financial_number from '#shared/is_financial_number.ts'
import type { ClientMetrics } from '#shared/type/client.ts'
import type { TenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'

type QueryArgument = {
	select_builder: TenantedSelectBuilder
	client_ids: readonly bigint[]
}

const proposals_query = ({ select_builder, client_ids }: QueryArgument) => select_builder
	.from('project')
	.join('project_document AS proposal_document', q => q.comparison('proposal_document.needs_client_approval_to_move_on', '=', { value: 1 }))
	.join('project_document_history AS history', q => q.and(
		q.comparison('history.project_id', '=', 'project.project_id'),
		q.comparison('history.project_document_id', '=', 'proposal_document.project_document_id'),
	))
	.where(q => q.in('project.client_id', client_ids))
	.group_by('project.client_id')
	.select(q => ['project.client_id', q.fn('COUNT DISTINCT', 'project.project_id', 'project.proposal_count')])
	.build()

const accepted_query = ({ select_builder, client_ids }: QueryArgument) => select_builder
	.from('project')
	.join('project_document AS billable_document', q => q.and(
		q.comparison('billable_document.project_document_id', '=', 'project.project_document_id'),
		q.comparison('billable_document.represents_billable_sale_when_closed', '=', { value: 1 }),
	))
	.where(q => q.in('project.client_id', client_ids))
	.group_by('project.client_id')
	.select(q => ['project.client_id', q.fn('COUNT', 'project.project_id', 'project.accepted_count')])
	.build()

const latest_jobs_query = ({ select_builder, client_ids, closed_on_or_after }: QueryArgument & {
	closed_on_or_after: Temporal.PlainDate
}) => select_builder
	.from('project')
	.join('project_document AS billable_document', q => q.and(
		q.comparison('billable_document.project_document_id', '=', 'project.project_document_id'),
		q.comparison('billable_document.represents_billable_sale_when_closed', '=', { value: 1 }),
	))
	.where(q => q.and(
		q.in('project.client_id', client_ids),
		q.comparison('project.closed', '=', { value: 1 }),
		q.comparison('project.closed_date', '>=', { value: closed_on_or_after }),
	))
	.group_by('project.client_id')
	.select(q => [
		'project.client_id',
		q.fn('SUM', 'project.total', 'project.latest_jobs_total'),
		q.fn('COUNT', 'project.project_id', 'project.latest_job_count'),
	])
	.build()

export const get_client_metrics = async ({ select_builder, timezone, client_ids }: QueryArgument & {
	timezone: string
}): Promise<ClientMetrics[]> => {
	if (client_ids.length === 0) return []

	const today = Temporal.Now.instant().toZonedDateTimeISO(timezone).toPlainDate()
	const closed_on_or_after = today.subtract(Temporal.Duration.from({ years: 1 }))

	const rows = await select_builder.get_rows(select_builder
		.from('client')
		.left_join(
			{ subquery: proposals_query({ select_builder, client_ids }), alias: 'proposals' },
			q => q.comparison('proposals.client_id', '=', 'client.client_id'),
		)
		.left_join(
			{ subquery: accepted_query({ select_builder, client_ids }), alias: 'accepted' },
			q => q.comparison('accepted.client_id', '=', 'client.client_id'),
		)
		.left_join(
			{ subquery: latest_jobs_query({ select_builder, client_ids, closed_on_or_after }), alias: 'latest_jobs' },
			q => q.comparison('latest_jobs.client_id', '=', 'client.client_id'),
		)
		.where(q => q.in('client.client_id', client_ids))
		.select(q => [
			'client.client_id',
			q.fn('IFNULL', 'proposals.proposal_count', { value: 0n }, 'client.proposals'),
			q.fn('IFNULL', 'accepted.accepted_count', { value: 0n }, 'client.accepted'),
			q.fn('IFNULL', 'latest_jobs.latest_jobs_total', { value: 0n }, 'client.latest_jobs_total'),
			q.fn('IFNULL', 'latest_jobs.latest_job_count', { value: 0n }, 'client.latest_job_count'),
		])
		.build())

	return map(rows, ({ client: { latest_jobs_total, ...metrics } }) => {
		assert(is_financial_number(latest_jobs_total), `the latest jobs total is a financial number`)
		return { ...metrics, latest_jobs_total }
	})
}
