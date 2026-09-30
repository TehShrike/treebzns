// Shape of one element in arbostar_export/lead_profiles.js (see export_line_items.ts +
// lead_profile_details.ts). One row per lead, with the lead, estimate, work order, and
// invoice fields that only the profile endpoints carry. `lead_id` links to leads.js.
// Estimated leads come from the estimate profile. Leads without an estimate come from the
// lead profile, and their estimate, workorder, and invoices are empty.
// Money amounts are strings as ArboStar sends them, e.g. '4240.00'. "Company-local" times are
// 'YYYY-MM-DD HH:MM:SS' in the company time zone. ISO instants end in Z.

export type ArbostarLeadProfile = {
	lead_id: number
	lead_no: string
	source: 'estimate_profile' | 'lead_profile'
	lead: ArbostarProfileLead
	estimate: ArbostarProfileEstimate | null
	workorder: ArbostarProfileWorkorder | null
	invoices: ArbostarProfileInvoice[]
}

export type ArbostarProfileLead = {
	/** ISO instant */
	created_at: string | null
	created_by_user_id: number | null
	created_by_name: string | null
	estimator_user_id: number | null
	/** Matches lead_statuses in profile_codebooks.js. */
	status_id: number
	/** Matches lead_no_go_reasons in profile_codebooks.js. */
	no_go_reason_id: number | null
	/** 'Regular' | 'Priority' | 'Emergency' */
	priority: string | null
	/** e.g. 'Right Away' */
	timing: string | null
	/** e.g. 'small' */
	preliminary_estimate: string | null
	latitude: number | null
	longitude: number | null
	/** Matches lead_sources in profile_codebooks.js. */
	lead_source_id: number | null
	referred_by_client_id: number | null
	referred_by_user_id: number | null
	contact_id: number | null
	comment_note: string
	additional_info: string
	/** YYYY-MM-DD */
	postpone_date: string | null
	/** YYYY-MM-DD */
	assigned_date: string | null
	gclid: string | null
	msclkid: string | null
	tax_name: string | null
	tax_rate: string | null
	tax_value: string | null
	/** ISO instant */
	updated_at: string | null
	/** Company-local time of the latest status change. */
	last_status_change: string | null
	/** Files on the lead other than line item photos (those are on line_items.js), e.g. payment receipts and signatures. */
	files: ArbostarProfileFile[]
}

export type ArbostarProfileFile = {
	file_id: number
	/** 'workorder' | 'invoice' | 'signature' | ... */
	module_type: string
	/** 'clients_files' | 'payment_files' | ... */
	group: string
	/** Relative to the account origin. */
	arbostar_path: string
	original_filename: string
	content_type: string
	filesize: number
	can_be_in_pdf: boolean
	in_estimate_pdf: boolean
	in_workorder_pdf: boolean
	in_invoice_pdf: boolean
	shared: boolean
}

export type ArbostarProfileEstimate = {
	estimate_id: number
	estimate_no: string
	/** ISO instant */
	created_at: string | null
	/** ISO instant. ArboStar's `date_due`. Its meaning is not verified. */
	date_due: string | null
	/** ISO instant */
	start_expiration_date: string | null
	/** ISO instant */
	updated_at: string | null
	/** Company-local time of the latest status change. On a declined estimate, the decline time. */
	last_status_change: string | null
	/** Matches estimate_statuses in profile_codebooks.js. */
	status_id: number
	/** Matches estimate_decline_reasons in profile_codebooks.js. */
	decline_reason_id: number | null
	estimator_user_id: number | null
	brand_id: number | null
	/** YYYY-MM-DD */
	review_date: string | null
	review_number: number | null
	planned_time: string | null
	provided_by: string | null
	crew_notes_for_items: string
	estimate_notes: string
	payment_notes: string
	portal_client_notes: string
	notes_from_portal: string
	tax_name: string | null
	tax_rate: string | null
	tax_value: string | null
	deposit_enabled: boolean
	deposit_percent: number | null
	signature_enabled: boolean
	deposit_with_signature: boolean
	/** 'Company' when the estimate uses the company default. */
	deposit_settings_source: string | null
	deposit_paid: boolean
	discount_amount: string | null
	discount_percent: number | null
	discount_comment: string
	totals: ArbostarProfileEstimateTotals | null
	groups: ArbostarProfileGroup[]
	/** Every time ArboStar emailed the estimate, oldest first. */
	emails: ArbostarProfileEmail[]
}

export type ArbostarProfileEstimateTotals = {
	sum_without_tax: string
	sum_actual_without_tax: string
	sum_for_services: string
	sum_taxable: string
	sum_non_taxable: string
	total_tax: string
	total_with_tax: string
	payments_total: string
	total_due: string
	discount_total: string
	interests_total: string
	credit_notes_total: string
	total_confirmed: string
	total_declined: string
	planned_time: string
	service_time: string
}

export type ArbostarProfileGroup = {
	group_id: number
	name: string
	description: string | null
	show_items: boolean
	show_invoice_items: boolean
	sort_order: number | null
	total: string | null
}

export type ArbostarProfileEmail = {
	email_id: number
	/** 'accepted' | 'delivered' | 'opened' | 'clicked' | 'bounce' | ... */
	status: string | null
	subject: string | null
	from: string | null
	to: string | null
	cc: string | null
	bcc: string | null
	sent_by_user_id: number | null
	template_id: number | null
	provider: string | null
	error: string | null
	/** Company-local */
	created: string | null
	/** Company-local time of the latest status change. */
	updated: string | null
}

export type ArbostarProfileWorkorder = {
	workorder_id: number
	workorder_no: string
	/** Matches workorder_statuses in profile_codebooks.js. */
	status_id: number
	/** ISO instant */
	created_at: string | null
	/** ISO instant */
	updated_at: string | null
	/** Company-local time of the latest status change. On a Finished work order, the finish time. */
	last_status_change: string | null
	/** e.g. 'deposit' */
	confirm_how: string | null
	deposit_taken_by: string | null
	deposit_paid: string | null
	scheduling_preference: string | null
	office_notes: string
	crew_notes: string
	estimator_user_id: number | null
	/** 'Regular' | 'Priority' | 'Emergency' */
	priority: string | null
	require_start_form: boolean
	require_finish_form: boolean
	/** The crew's completion report. Each field is null until the crew fills it in. */
	completion_report: {
		time_left_office: string | null
		time_arrived_site: string | null
		time_left_site: string | null
		time_arrived_office: string | null
		job_completed: string | null
		payment_received: string | null
		left_todo: string | null
		any_damage: string | null
		equipment_malfunction: string | null
		completion_note: string | null
	}
	/** Paths of the files that go in the work order PDF. */
	pdf_files: string[]
	/** Schedule event ids (schedule_events.js in the API export). */
	schedule_event_ids: number[]
}

export type ArbostarProfileInvoice = {
	invoice_id: number
	invoice_no: string
	workorder_id: number | null
	/** ArboStar's invoice status id. */
	status_id: number
	/** YYYY-MM-DD */
	date_created: string | null
	/** YYYY-MM-DD */
	due_date: string | null
	/** YYYY-MM-DD */
	overdue_date: string | null
	/** YYYY-MM-DD */
	paid_date: string | null
	sent_date: string | null
	/** ISO instant */
	updated_at: string | null
	/** Company-local time of the latest status change. */
	last_status_change: string | null
	payment_mode: string | null
	payment_amount: string | null
	finished_how: string | null
	crew_notes: string | null
	notes: string | null
	feedback: string | null
	interest_rate: string | null
	interest_status: string | null
	due_in_days: number | null
	/** QuickBooks or other accounting integration ids. */
	integration_id: string | null
	integration_invoice_no: string | null
	qb_id: string | null
	qb_invoice_no: string | null
	discount_amount: string | null
	discount_percent: number | null
	totals: ArbostarProfileInvoiceTotals | null
	/** Interest charges, one per overdue period. */
	interest: { overdue_date: string | null; rate: number | null; cost: number | null }[]
	/** Paths of the files that go in the invoice PDF. */
	pdf_files: string[]
}

export type ArbostarProfileInvoiceTotals = {
	sum_without_tax: string
	sum_actual_without_tax: string
	sum_for_services: string
	sum_taxable: string
	sum_non_taxable: string
	total_tax: string
	total_with_tax: string
	sum_payment_total: string
	total_due: string
	discount_total: string
	interest_total: string
	credit_notes_total: string
}

// lead_profiles.js is an ESM module whose default export is the full array of records.
declare const lead_profiles: ArbostarLeadProfile[]
export default lead_profiles
