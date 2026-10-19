import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'

export const select_project_documents = (query: ClientQueryFn) => query(
	query_builder<Schema>()
		.from(`project_document`)
		.select(() => [
			`project_document.project_document_id`,
			`project_document.name`,
			`project_document.needs_estimate_to_move_on`,
			`project_document.needs_client_approval_to_move_on`,
			`project_document.can_expire`,
			`project_document.expire_days`,
			`project_document.next_project_document_id`,
			`project_document.should_be_worked`,
			`project_document.needs_to_be_contacted_by_lead_qualifier`,
			`project_document.represents_billable_sale_when_closed`,
			`project_document.declined`,
			`project_document.closed_by_default`,
			`project_document.declined_project_document_id`,
			`project_document.sort`,
			`project_document.created_at`,
			`project_document.updated_at`,
		] as const)
		.order_by(`project_document.name`, `ASC`)
		.build()
).get_table_identifier_rows(`project_document`)

export type ProjectDocumentRow = Awaited<ReturnType<typeof select_project_documents>>[number]
