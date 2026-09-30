// Maps the lead, estimate, work order, and invoice fields of the estimate profile and the
// lead profile to lead_profiles.js, and the id → name lists that both responses repeat to
// profile_codebooks.js. export_line_items.ts applies it to every profile it fetches.
// Shapes: #arbostar_export/lead_profiles.d.ts and profile_codebooks.d.ts.

import { filter, filter_map, flat_map, flatten, map } from '#shared/array.ts'
import type { ExportShape } from './output.ts'
import type { ArboStarService } from './estimate_services.ts'
import type {
	ArbostarLeadProfile,
	ArbostarProfileEmail,
	ArbostarProfileEstimate,
	ArbostarProfileFile,
	ArbostarProfileGroup,
	ArbostarProfileInvoice,
	ArbostarProfileLead,
	ArbostarProfileWorkorder,
} from '#arbostar_export/lead_profiles.d.ts'
import type { ArbostarProfileCodebooks } from '#arbostar_export/profile_codebooks.d.ts'

type Flag = number | boolean | null | undefined
type Money = string | null

type RawLeadFile = {
	id: number
	module_type: string
	group: string
	filepath: string
	original_filename: string
	mime_type: string
	size: string
	can_be_in_pdf: boolean
	is_estimate_pdf: boolean
	is_workorder_pdf: boolean
	is_invoice_pdf: boolean
	is_shared: boolean
}

type RawLead = {
	lead_id: number
	lead_no: string
	lead_author_id: number | null
	lead_created_by: string | null
	lead_date_created: string | null
	lead_estimator: number | null
	lead_status_id: number
	lead_reason_status_id: number | null
	lead_priority: string | null
	timing: string | null
	preliminary_estimate: string | null
	latitude: number | string | null
	longitude: number | string | null
	lead_reffered_by: number | null
	lead_reffered_client: number | null
	lead_reffered_user: number | null
	lead_contact_id: number | null
	lead_comment_note: string | null
	lead_add_info: string | null
	lead_postpone_date: string | null
	lead_assigned_date: string | null
	lead_gclid: string | null
	lead_msclkid: string | null
	lead_tax_name: string | null
	lead_tax_rate: string | null
	lead_tax_value: string | null
	updated_at: string | null
	last_update_status: string | null
	files?: RawLeadFile[]
}

type RawEmail = {
	email_id: number
	email_status: string | null
	email_subject: string | null
	email_from: string | null
	email_to: string | null
	email_cc: string | null
	email_bcc: string | null
	email_user_id: number | null
	email_template_id: number | null
	email_provider: string | null
	email_error: string | null
	email_created_at: string | null
	email_updated_at: string | null
}

type RawGroup = {
	id: number
	name: string
	description: string | null
	show_items: Flag
	show_invoice_items: Flag
	sort_order: number | null
	total: Money
	type: 'group'
}

type RawWorkorder = {
	id: number
	workorder_no: string
	wo_status: number
	date_created: string | null
	updated_at: string | null
	last_update_status: string | null
	wo_confirm_how: string | null
	wo_deposit_taken_by: string | null
	wo_deposit_paid: Money
	wo_scheduling_preference: string | null
	wo_office_notes: string | null
	wo_extra_not_crew: string | null
	wo_estimator: number | null
	wo_priority: string | null
	require_start_form: Flag
	require_finish_form: Flag
	in_time_left_office: string | null
	in_time_arrived_site: string | null
	in_time_left_site: string | null
	in_time_arrived_office: string | null
	in_job_completed: string | null
	in_payment_received: string | null
	in_left_todo: string | null
	in_any_damage: string | null
	in_eq_malfuntion: string | null
	in_note_completion: string | null
	wo_pdf_files: string[] | null
	schedules?: { id: number }[]
}

type RawInvoice = {
	id: number
	invoice_no: string
	workorder_id: number | null
	in_status: number
	date_created: string | null
	due_date: string | null
	overdue_date: string | null
	paid_date: string | null
	sent_date: string | null
	updated_at: string | null
	last_update_status: string | null
	payment_mode: string | null
	payment_amount: Money
	in_finished_how: string | null
	in_extra_note_crew: string | null
	invoice_notes: string | null
	invoice_feedback: string | null
	interest_rate: string | null
	interest_status: string | null
	invoice_due_in_days: number | null
	invoice_integration_id: string | null
	integration_invoice_no: string | null
	invoice_qb_id: string | null
	qb_invoice_no: string | null
	invoice_pdf_files: string[] | null
	discount: { discount_amount: Money; discount_percents: number | null } | null
	totals: Record<string, string | number> | null
	invoice_interest?: { overdue_date: string | null; rate: number | null; interes_cost: number | null }[]
}

type RawEstimate = {
	estimate_id: number
	estimate_no: string
	date_created: number | null
	date_due: number | null
	start_expiration_date: number | null
	updated_at: string | null
	last_update_status: string | null
	estimate_status_id: number
	estimate_reason_decline: number | null
	user_id: number | null
	estimate_brand_id: number | null
	estimate_review_date: string | null
	estimate_review_number: number | null
	estimate_planned_time: string | null
	estimate_provided_by: string | null
	estimate_item_note_crew: string | null
	estimate_item_note_estimate: string | null
	estimate_item_note_payment: string | null
	estimate_portal_client_notes: string | null
	tmp_notes_from_portal: string | null
	estimate_tax_name: string | null
	estimate_tax_rate: string | null
	estimate_tax_value: string | null
	confirmation_options?: {
		resolved?: { deposit_enabled: boolean; deposit_percent: number | null; signature_enabled: boolean; deposit_with_signature: boolean }
		resolved_source?: string | null
		deposit_paid?: boolean
	}
	discount: { discount_amount: Money; discount_percents: number | null; discount_comment: string | null } | null
	totals: Record<string, string | number> | null
	estimate_services_with_groups?: (ArboStarService | RawGroup)[]
	emails?: RawEmail[]
	workorder?: RawWorkorder | null
	invoices?: RawInvoice[]
}

export type ProfilePayload = {
	lead?: (RawLead & { estimate?: RawEstimate | [] | null }) | null
	reference?: { id: number; text: string; slug: string; with_comment: Flag; deleted_at: string | null }[]
	reasons?: Record<string, { reason_id: number; reason_name: string; reason_lead_status_id: number; reason_active: Flag }[]>
	leadStatuses?: {
		lead_status_id: number
		lead_status_name: string
		lead_status_active: Flag
		lead_status_estimated: Flag
		lead_status_default: Flag
		lead_status_draft: Flag
	}[]
	estimate_statuses?: {
		est_status_id: number
		est_status_name: string
		est_status_active: Flag
		est_status_declined: Flag
		est_status_confirmed: Flag
		est_status_sent: Flag
		est_status_expired: Flag
		est_status_default: Flag
		reason?: { reason_id: number; reason_name: string; reason_est_status_id: number; reason_active: Flag }[]
	}[]
	wo_statuses?: {
		wo_status_id: number
		wo_status_name: string
		wo_status_active: Flag
		is_default: Flag
		is_finished: Flag
		is_confirm_by_client: Flag
		is_finished_by_field: Flag
		is_scheduled_pending: Flag
		is_client_contacted: Flag
		wo_status_priority: number
	}[]
	payment_methods?: Record<string, { id: number; title: string; published: Flag; is_cc: Flag; is_ach: Flag }>
}

const flag = (value: Flag): boolean => value === true || value === 1

const id_or_null = (value: number | null | undefined): number | null => (value ? value : null)

const text = (value: string | null | undefined): string => (value ?? '').replace(/\r\n/g, '\n').trim()

const number_or_null = (value: number | string | null | undefined): number | null =>
	value == null || value === '' ? null : Number(value)

const iso_from_unix = (seconds: number | null | undefined): string | null =>
	seconds ? new Date(seconds * 1000).toISOString() : null

export const iso_from_us_date = (us_date: string | null | undefined): string | null => {
	const match = us_date ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(us_date) : null
	return match ? `${match[3]}-${match[1]}-${match[2]}` : null
}

const BOOKKEEPING_KEYS = new Set(['id', 'et_id', 'estimate_id', 'invoice_id', 'tenant_id', 'last_update', 'system_create', 'system_update'])

const totals_of = (totals: Record<string, string | number> | null): Record<string, string | number> | null =>
	totals && Object.fromEntries(filter(Object.entries(totals), ([key]) => !BOOKKEEPING_KEYS.has(key)))

const lead_file = (file: RawLeadFile): ExportShape<ArbostarProfileFile> => ({
	file_id: file.id,
	module_type: file.module_type,
	group: file.group,
	arbostar_path: file.filepath,
	original_filename: file.original_filename,
	content_type: file.mime_type,
	filesize: Number(file.size),
	can_be_in_pdf: file.can_be_in_pdf,
	in_estimate_pdf: file.is_estimate_pdf,
	in_workorder_pdf: file.is_workorder_pdf,
	in_invoice_pdf: file.is_invoice_pdf,
	shared: file.is_shared,
})

const to_lead = (lead: RawLead): ExportShape<ArbostarProfileLead> => ({
	created_at: lead.lead_date_created,
	created_by_user_id: id_or_null(lead.lead_author_id),
	created_by_name: lead.lead_created_by,
	estimator_user_id: id_or_null(lead.lead_estimator),
	status_id: lead.lead_status_id,
	no_go_reason_id: id_or_null(lead.lead_reason_status_id),
	priority: lead.lead_priority,
	timing: lead.timing,
	preliminary_estimate: lead.preliminary_estimate,
	latitude: number_or_null(lead.latitude),
	longitude: number_or_null(lead.longitude),
	lead_source_id: id_or_null(lead.lead_reffered_by),
	referred_by_client_id: id_or_null(lead.lead_reffered_client),
	referred_by_user_id: id_or_null(lead.lead_reffered_user),
	contact_id: id_or_null(lead.lead_contact_id),
	comment_note: text(lead.lead_comment_note),
	additional_info: text(lead.lead_add_info),
	postpone_date: lead.lead_postpone_date,
	assigned_date: lead.lead_assigned_date,
	gclid: lead.lead_gclid,
	msclkid: lead.lead_msclkid,
	tax_name: lead.lead_tax_name,
	tax_rate: lead.lead_tax_rate,
	tax_value: lead.lead_tax_value,
	updated_at: lead.updated_at,
	last_status_change: lead.last_update_status,
	files: map(filter(lead.files ?? [], file => file.module_type !== 'service'), lead_file),
})

const to_email = (email: RawEmail): ExportShape<ArbostarProfileEmail> => ({
	email_id: email.email_id,
	status: email.email_status,
	subject: email.email_subject,
	from: email.email_from,
	to: email.email_to,
	cc: email.email_cc,
	bcc: email.email_bcc,
	sent_by_user_id: id_or_null(email.email_user_id),
	template_id: email.email_template_id,
	provider: email.email_provider,
	error: email.email_error,
	created: email.email_created_at,
	updated: email.email_updated_at,
})

const to_group = (group: RawGroup): ExportShape<ArbostarProfileGroup> => ({
	group_id: group.id,
	name: group.name,
	description: group.description,
	show_items: flag(group.show_items),
	show_invoice_items: flag(group.show_invoice_items),
	sort_order: group.sort_order,
	total: group.total,
})

const is_group = (row: ArboStarService | RawGroup): row is RawGroup => row.type === 'group'

const to_estimate = (estimate: RawEstimate): ExportShape<ArbostarProfileEstimate> => {
	const resolved = estimate.confirmation_options?.resolved
	return {
		estimate_id: estimate.estimate_id,
		estimate_no: estimate.estimate_no,
		created_at: iso_from_unix(estimate.date_created),
		date_due: iso_from_unix(estimate.date_due),
		start_expiration_date: iso_from_unix(estimate.start_expiration_date),
		updated_at: estimate.updated_at,
		last_status_change: estimate.last_update_status,
		status_id: estimate.estimate_status_id,
		decline_reason_id: id_or_null(estimate.estimate_reason_decline),
		estimator_user_id: id_or_null(estimate.user_id),
		brand_id: id_or_null(estimate.estimate_brand_id),
		review_date: estimate.estimate_review_date,
		review_number: estimate.estimate_review_number,
		planned_time: estimate.estimate_planned_time,
		provided_by: estimate.estimate_provided_by,
		crew_notes_for_items: text(estimate.estimate_item_note_crew),
		estimate_notes: text(estimate.estimate_item_note_estimate),
		payment_notes: text(estimate.estimate_item_note_payment),
		portal_client_notes: text(estimate.estimate_portal_client_notes),
		notes_from_portal: text(estimate.tmp_notes_from_portal),
		tax_name: estimate.estimate_tax_name,
		tax_rate: estimate.estimate_tax_rate,
		tax_value: estimate.estimate_tax_value,
		deposit_enabled: resolved?.deposit_enabled ?? false,
		deposit_percent: resolved?.deposit_percent ?? null,
		signature_enabled: resolved?.signature_enabled ?? false,
		deposit_with_signature: resolved?.deposit_with_signature ?? false,
		deposit_settings_source: estimate.confirmation_options?.resolved_source ?? null,
		deposit_paid: estimate.confirmation_options?.deposit_paid ?? false,
		discount_amount: estimate.discount?.discount_amount ?? null,
		discount_percent: estimate.discount?.discount_percents ?? null,
		discount_comment: text(estimate.discount?.discount_comment),
		totals: totals_of(estimate.totals),
		groups: filter_map(estimate.estimate_services_with_groups ?? [], row => (is_group(row) ? to_group(row) : null)),
		emails: map(estimate.emails ?? [], to_email),
	}
}

const to_workorder = (workorder: RawWorkorder): ExportShape<ArbostarProfileWorkorder> => ({
	workorder_id: workorder.id,
	workorder_no: workorder.workorder_no,
	status_id: workorder.wo_status,
	created_at: workorder.date_created,
	updated_at: workorder.updated_at,
	last_status_change: workorder.last_update_status,
	confirm_how: workorder.wo_confirm_how,
	deposit_taken_by: workorder.wo_deposit_taken_by,
	deposit_paid: workorder.wo_deposit_paid,
	scheduling_preference: workorder.wo_scheduling_preference,
	office_notes: text(workorder.wo_office_notes),
	crew_notes: text(workorder.wo_extra_not_crew),
	estimator_user_id: id_or_null(workorder.wo_estimator),
	priority: workorder.wo_priority,
	require_start_form: flag(workorder.require_start_form),
	require_finish_form: flag(workorder.require_finish_form),
	completion_report: {
		time_left_office: workorder.in_time_left_office,
		time_arrived_site: workorder.in_time_arrived_site,
		time_left_site: workorder.in_time_left_site,
		time_arrived_office: workorder.in_time_arrived_office,
		job_completed: workorder.in_job_completed,
		payment_received: workorder.in_payment_received,
		left_todo: workorder.in_left_todo,
		any_damage: workorder.in_any_damage,
		equipment_malfunction: workorder.in_eq_malfuntion,
		completion_note: workorder.in_note_completion,
	},
	pdf_files: workorder.wo_pdf_files ?? [],
	schedule_event_ids: map(workorder.schedules ?? [], schedule => schedule.id),
})

const to_invoice = (invoice: RawInvoice): ExportShape<ArbostarProfileInvoice> => ({
	invoice_id: invoice.id,
	invoice_no: invoice.invoice_no,
	workorder_id: invoice.workorder_id,
	status_id: invoice.in_status,
	date_created: invoice.date_created,
	due_date: invoice.due_date,
	overdue_date: invoice.overdue_date,
	paid_date: invoice.paid_date,
	sent_date: invoice.sent_date,
	updated_at: invoice.updated_at,
	last_status_change: invoice.last_update_status,
	payment_mode: invoice.payment_mode,
	payment_amount: invoice.payment_amount,
	finished_how: invoice.in_finished_how,
	crew_notes: invoice.in_extra_note_crew,
	notes: invoice.invoice_notes,
	feedback: invoice.invoice_feedback,
	interest_rate: invoice.interest_rate,
	interest_status: invoice.interest_status,
	due_in_days: invoice.invoice_due_in_days,
	integration_id: invoice.invoice_integration_id,
	integration_invoice_no: invoice.integration_invoice_no,
	qb_id: invoice.invoice_qb_id,
	qb_invoice_no: invoice.qb_invoice_no,
	discount_amount: invoice.discount?.discount_amount ?? null,
	discount_percent: invoice.discount?.discount_percents ?? null,
	totals: totals_of(invoice.totals),
	interest: map(invoice.invoice_interest ?? [], interest => ({
		overdue_date: interest.overdue_date,
		rate: interest.rate,
		cost: interest.interes_cost,
	})),
	pdf_files: invoice.invoice_pdf_files ?? [],
})

export const to_lead_profile = (
	lead_id: number,
	payload: ProfilePayload,
	source: ArbostarLeadProfile['source'],
): ExportShape<ArbostarLeadProfile> | null => {
	const lead = payload.lead
	if (!lead) {
		return null
	}
	const estimate = Array.isArray(lead.estimate) ? null : (lead.estimate ?? null)
	return {
		lead_id,
		lead_no: lead.lead_no,
		source,
		lead: to_lead(lead),
		estimate: estimate && to_estimate(estimate),
		workorder: estimate?.workorder ? to_workorder(estimate.workorder) : null,
		invoices: map(estimate?.invoices ?? [], to_invoice),
	}
}

export const to_lead_codebooks = (payload: ProfilePayload) => ({
	lead_sources: map(payload.reference ?? [], source => ({
		lead_source_id: source.id,
		name: source.text,
		slug: source.slug,
		with_comment: flag(source.with_comment),
		deleted: source.deleted_at !== null,
	})),
	lead_no_go_reasons: map(flatten(Object.values(payload.reasons ?? {})), reason => ({
		reason_id: reason.reason_id,
		name: reason.reason_name,
		lead_status_id: reason.reason_lead_status_id,
		active: flag(reason.reason_active),
	})),
	lead_statuses: map(payload.leadStatuses ?? [], status => ({
		lead_status_id: status.lead_status_id,
		name: status.lead_status_name,
		active: flag(status.lead_status_active),
		estimated: flag(status.lead_status_estimated),
		default: flag(status.lead_status_default),
		draft: flag(status.lead_status_draft),
	})),
}) satisfies Partial<ArbostarProfileCodebooks>

export const to_estimate_codebooks = (payload: ProfilePayload) => ({
	estimate_statuses: map(payload.estimate_statuses ?? [], status => ({
		estimate_status_id: status.est_status_id,
		name: status.est_status_name,
		active: flag(status.est_status_active),
		declined: flag(status.est_status_declined),
		confirmed: flag(status.est_status_confirmed),
		sent: flag(status.est_status_sent),
		expired: flag(status.est_status_expired),
		default: flag(status.est_status_default),
	})),
	estimate_decline_reasons: map(
		flat_map(payload.estimate_statuses ?? [], status => status.reason ?? []),
		reason => ({
			reason_id: reason.reason_id,
			name: reason.reason_name,
			estimate_status_id: reason.reason_est_status_id,
			active: flag(reason.reason_active),
		}),
	),
	workorder_statuses: map(payload.wo_statuses ?? [], status => ({
		workorder_status_id: status.wo_status_id,
		name: status.wo_status_name,
		active: flag(status.wo_status_active),
		default: flag(status.is_default),
		finished: flag(status.is_finished),
		confirmed_by_client: flag(status.is_confirm_by_client),
		finished_by_field: flag(status.is_finished_by_field),
		scheduled_pending: flag(status.is_scheduled_pending),
		client_contacted: flag(status.is_client_contacted),
		priority: status.wo_status_priority,
	})),
	payment_methods: map(Object.values(payload.payment_methods ?? {}), method => ({
		payment_method_id: method.id,
		name: method.title,
		published: flag(method.published),
		credit_card: flag(method.is_cc),
		ach: flag(method.is_ach),
	})),
}) satisfies Partial<ArbostarProfileCodebooks>
