import fnum from '#shared/fnum.ts'
import { Temporal } from '@js-temporal/polyfill'

export const company = {
	logo: null,
	default_crew_start_time: Temporal.PlainTime.from(`08:00`),
	invoice_due_after_days: 30n,
	round_line_item_estimates_to_nearest: fnum(`20.00`),
} as const satisfies Partial<DbCompany>

export const project_number = {
	next_number: 1100n,
} as const satisfies Partial<DbProjectNumber>

export const invoice_number = {
	next_number: 1100n,
} as const satisfies Partial<DbInvoiceNumber>

export const employee = {
	phone: ``,
	is_owner: false,
	default_crew_id: null,
} as const satisfies Partial<DbEmployee>

export const client = {
	name: ``,
	is_commercial: false,
	billing_name: ``,
	billing_address_line_1: ``,
	billing_address_line_2: ``,
	billing_city: ``,
	billing_state: ``,
	billing_zip: ``,
	billing_phone: ``,
	billing_email: ``,
	tax_rate_id: null,
	notes: ``,
	referred_by: ``,
} as const satisfies Partial<DbClient>

export const client_address = {
	client_contact_id: null,
	name: ``,
	address_line_1: ``,
	address_line_2: ``,
	city: ``,
	state: ``,
	zip: ``,
} as const satisfies Partial<DbClientAddress>

export const client_contact = {
	description: ``,
	name: ``,
	phone: ``,
	email: ``,
	is_primary: false,
} as const satisfies Partial<DbClientContact>

export const project = {
	due_date: null,
	emergency: false,
	assigned_estimator_employee_id: null,
	lead_details: ``,
	estimated_crew_size: null,
	needs_client_approval: false,
	sent_for_client_approval: false,
	taxable: false,
	tax_rate_id: null,
	tax_rate: null,
	discount_rate: null,
	discount: null,
	discount_description: ``,
	line_item_discount_subtotal: null,
	notes_for_crew: ``,
	notes_for_office: ``,
	closed: false,
	closed_at: null,
	closed_date: null,
	project_decline_reason_id: null,
	lead_source_id: null,
} as const satisfies Partial<DbProject>

export const project_line_item = {
	item_type_id: null,
	line_item_template_id: null,
	work_details: ``,
	estimated_crew_size: 1n,
	estimated_hours: 0n,
	taxable: false,
	client_optional: false,
	client_declined: false,
	quantity: fnum(`1.00`),
	price: fnum(`0.00`),
	discount_rate: null,
	discount: null,
	discount_description: ``,
	done_at: null,
	done_by_employee_id: null,
	arbostar_line_item_id: null,
} as const satisfies Partial<DbProjectLineItem>

export const project_line_item_work_skill = {
	count: 1n,
}

export const project_image = {
	original_object_key: ``,
	display_object_key: ``,
	thumbnail_object_key: ``,
	description: ``,
	visible_to_client: true,
	uploaded_at: null,
	arbostar_image_id: null,
} as const satisfies Partial<DbProjectImage>

export const invoice_line_item = {
	quantity: fnum(`1.00`),
	price: fnum(`0.00`),
	discount_rate: null,
	discount: null,
	discount_description: ``,
} as const satisfies Partial<DbInvoiceLineItem>
