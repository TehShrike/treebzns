import tracked_record from '#client/lib/tracked_record.svelte.ts'
import type { CachedClient, CachedClientContact } from '#client/lib/client_cache.svelte.ts'
import type { LeadClientValues, LeadAddressValues, LeadContactValues, LeadBilling, LeadProject, LeadAvailability } from '#shared/type/lead.ts'
import { find } from '#shared/array.ts'

const make_lead_form = (initial_estimator_employee_id: bigint | null) => {
	const client = tracked_record<LeadClientValues, 'client_id'>({
		initial: { name: ``, primary_phone: ``, primary_email: ``, referred_by: ``, tax_rate_id: null, is_commercial: false, notes: `` },
		id_key: `client_id`,
	})
	const address = tracked_record<LeadAddressValues, 'client_address_id'>({
		initial: { address_line_1: ``, address_line_2: ``, city: ``, state: ``, zip: `` },
		id_key: `client_address_id`,
	})
	const contact = tracked_record<LeadContactValues, 'client_contact_id'>({
		initial: { name: ``, phone: ``, email: `` },
		id_key: `client_contact_id`,
	})

	let selected_client = $state.raw<CachedClient | null>(null)
	let billing_address = $state<LeadBilling | null>(null)
	let project = $state<LeadProject>({
		due_date: null,
		emergency: false,
		lead_details: ``,
		notes_for_crew: ``,
		notes_for_office: ``,
		assigned_estimator_employee_id: initial_estimator_employee_id,
		lead_source_id: null,
		lead_source_name: null,
	})
	let availability = $state<LeadAvailability[]>([])

	const values_to_save = $derived({
		client: client.values_to_save,
		billing_address,
		address: address.values_to_save,
		contact: contact.values_to_save,
		project,
		availability,
	})

	const select_client = (cached_client: CachedClient, matched_contact: CachedClientContact | null) => {
		selected_client = cached_client
		client.set_values(cached_client.client)
		billing_address = null

		const default_address = find(cached_client.client_addresses, row => row.client_address_id === cached_client.client.default_project_address_id)
			?? cached_client.client_addresses[0]
		default_address ? address.set_values(default_address) : address.clear()

		const default_contact = matched_contact
			?? find(cached_client.client_contacts, row => row.is_primary)
			?? cached_client.client_contacts[0]
		default_contact ? contact.set_values(default_contact) : contact.clear()
	}

	const clear_client = () => {
		selected_client = null
		client.clear()
		address.clear()
		contact.clear()
	}

	return {
		client,
		address,
		contact,
		get selected_client() { return selected_client },
		get billing_address() { return billing_address },
		set billing_address(value) { billing_address = value },
		get project() { return project },
		set project(value) { project = value },
		get availability() { return availability },
		set availability(value) { availability = value },
		get values_to_save() { return values_to_save },
		select_client,
		clear_client,
	}
}

export type LeadForm = ReturnType<typeof make_lead_form>

export default make_lead_form
