// The line items on the estimate profile (/estimates/profile/profileData/{lead_id}).
// lead.estimate.estimate_services_with_groups is in display order and holds the standalone
// items (type 'item') interleaved with service groups (type 'group'), each group nesting its
// child line items under estimates_services. Group ids are their own sequence and collide
// with item ids, so group rows never become line items; only their children do.
// lead.estimate.estimates_service holds the standalone items only and is the fallback when
// estimate_services_with_groups is absent.

import assert from 'node:assert/strict'

import { filter, flat_map } from '#shared/array.ts'

export type ArboStarServiceFile = {
	id: number
	owner_id: number
	user_id: number | null
	original_filename: string
	extension: string
	filesize: string
	type: string
	full_path: string
	thumbnail: string | null
	sort_order: number | null
	group: string
	system_create: string | null
	system_update: string | null
	can_be_in_pdf: boolean
	is_estimate_pdf: boolean
	is_workorder_pdf: boolean
	is_invoice_pdf: boolean
	is_shared: boolean
}

export type ArboStarService = {
	id: number
	estimate_id: number | null
	invoice_id: number | null
	service_id: number | null
	service_description: string | null
	quantity: number | null
	service_price: number | string | null
	cost: number | string | null
	service_time: number | null
	service_size: string | null
	service_species: string | null
	service_reason: string | null
	optional: number | null
	is_fee: number | null
	is_additional_work: number | null
	non_taxable: number | null
	sort_order: number | null
	service_crews: string | null
	service: { service_name: string | null } | null
	status: { services_status_name: string | null } | null
	service_status: number | null
	status_log: { status_date: number | null; status_user_id: number | null } | null
	completed_status_date: string | null
	service_times_with_crew: number | null
	service_travel_time: number | null
	crew?: { crew_id: number }[]
	service_equipments: string | null
	service_tools: string | null
	estimate_group_id: number | null
	schedule_event_services?: { event_id: number }[]
	upcoming_event_ids?: number[]
	integration_service_date: string | null
	system_create: string | null
	system_update: string | null
	type: 'item' | 'group'
	files?: ArboStarServiceFile[]
	estimates_services?: ArboStarService[]
}

export type EstimateServices = {
	estimates_service?: ArboStarService[]
	estimate_services_with_groups?: ArboStarService[]
}

const is_item = (row: ArboStarService) => row.type === 'item'

export function services_of(estimate: EstimateServices | null | undefined): { services: ArboStarService[]; group_count: number; grouped_count: number } {
	const rows = estimate?.estimate_services_with_groups
	if (!Array.isArray(rows)) {
		assert(Array.isArray(estimate?.estimates_service), 'the estimate profile lists estimate_services_with_groups or estimates_service')
		return { services: filter(estimate.estimates_service, is_item), group_count: 0, grouped_count: 0 }
	}
	const children_of = (row: ArboStarService) => (row.type === 'group' ? (row.estimates_services ?? []) : [row])
	const services = flat_map(rows, children_of)
	const group_count = filter(rows, row => row.type === 'group').length
	return { services, group_count, grouped_count: services.length - filter(rows, is_item).length }
}
