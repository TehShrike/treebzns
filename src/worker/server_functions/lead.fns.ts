import assert from '#shared/assert.ts'
import * as jv from '#shared/json_validator.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import { is_temporal_plain_date, is_temporal_plain_time } from '#schema/validator/_helpers.ts'
import get_next_project_number_and_increment from '#worker/lib/db/get_next_project_number_and_increment.ts'
import { get_lead_project_document_id } from '#worker/lib/db/project_document.ts'
import assert_db_id_valid from '#worker/lib/db/assert_db_id_valid.ts'
import { upsert_client } from './lead_helper/client.ts'
import { upsert_client_address } from './lead_helper/client_address.ts'
import { upsert_client_contact } from './lead_helper/client_contact.ts'
import { insert_lead_source } from './lead_helper/lead_source.ts'
import { filter_map, for_each_parallel, map } from '#shared/array.ts'
import type { TenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { LeadClient, LeadBilling, LeadAddress, LeadContact } from '#shared/type/lead.ts'

const project_field_validators = {
	due_date: jv.nullable(is_temporal_plain_date),
	emergency: jv.is_boolean,
	lead_details: jv.is_string,
	notes_for_crew: jv.is_string,
	notes_for_office: jv.is_string,
	assigned_estimator_employee_id: jv.nullable(jv.is_bigint),
}

const create_lead_validator: jv.Validator<{
	client: LeadClient
	billing_address: LeadBilling | null
	address: LeadAddress
	contact: LeadContact
	project: {
		due_date: DbProject['due_date']
		emergency: DbProject['emergency']
		lead_details: DbProject['lead_details']
		notes_for_crew: DbProject['notes_for_crew']
		notes_for_office: DbProject['notes_for_office']
		assigned_estimator_employee_id: DbProject['assigned_estimator_employee_id']
	} & ({ lead_source_id: bigint, lead_source_name: null } | { lead_source_id: null, lead_source_name: string | null })
	availability: {
		availability_date: DbEstimateAvailability['availability_date']
		start_time: DbEstimateAvailability['start_time']
		end_time: DbEstimateAvailability['end_time']
	}[]
}> = jv.object({
	client: jv.object({
		client_id: jv.nullable(jv.is_bigint),
		name: jv.is_string,
		primary_phone: jv.is_string,
		primary_email: jv.is_string,
		referred_by: jv.is_string,
		tax_rate_id: jv.nullable(jv.is_bigint),
		is_commercial: jv.is_boolean,
		notes: jv.is_string,
	}),
	billing_address: jv.nullable(jv.object({
		billing_name: jv.is_string,
		billing_address_line_1: jv.is_string,
		billing_address_line_2: jv.is_string,
		billing_city: jv.is_string,
		billing_state: jv.is_string,
		billing_zip: jv.is_string,
	})),
	address: jv.object({
		client_address_id: jv.nullable(jv.is_bigint),
		address_line_1: jv.is_string,
		address_line_2: jv.is_string,
		city: jv.is_string,
		state: jv.is_string,
		zip: jv.is_string,
	}),
	contact: jv.object({
		client_contact_id: jv.nullable(jv.is_bigint),
		name: jv.is_string,
		phone: jv.is_string,
		email: jv.is_string,
	}),
	project: jv.one_of(
		jv.object({
			...project_field_validators,
			lead_source_id: jv.is_bigint,
			lead_source_name: jv.is_null,
		}),
		jv.object({
			...project_field_validators,
			lead_source_id: jv.is_null,
			lead_source_name: jv.nullable(jv.is_string),
		}),
	),
	availability: jv.array(jv.object({
		availability_date: is_temporal_plain_date,
		start_time: is_temporal_plain_time,
		end_time: is_temporal_plain_time,
	})),
})

const assert_input_ids_valid = async ({
	client,
	address,
	contact,
	project,
	select_builder,
}: {
	client: LeadClient
	address: LeadAddress
	contact: LeadContact
	project: { lead_source_id: bigint | null, assigned_estimator_employee_id: bigint | null }
	select_builder: TenantedSelectBuilder
}) => Promise.all([
	client.client_id !== null && assert_db_id_valid({ select_builder, table_name: 'client', id: client.client_id }),
	client.tax_rate_id !== null && assert_db_id_valid({ select_builder, table_name: 'tax_rate', id: client.tax_rate_id }),
	address.client_address_id !== null && assert_db_id_valid({ select_builder, table_name: 'client_address', id: address.client_address_id }),
	contact.client_contact_id !== null && assert_db_id_valid({ select_builder, table_name: 'client_contact', id: contact.client_contact_id }),
	project.lead_source_id !== null && assert_db_id_valid({ select_builder, table_name: 'lead_source', id: project.lead_source_id }),
	project.assigned_estimator_employee_id !== null && assert_db_id_valid({ select_builder, table_name: 'employee', id: project.assigned_estimator_employee_id }),
])

const address_to_billing_address = (name: string, address: LeadAddress) => ({
	billing_name: name,
	billing_address_line_1: address.address_line_1,
	billing_address_line_2: address.address_line_2,
	billing_city: address.city,
	billing_state: address.state,
	billing_zip: address.zip,
})

export const functions = {
	create_lead: sfn({
		validator: create_lead_validator,
		fn: (
			{ client, billing_address, address, contact, project, availability },
			{ company, user, select_builder, write_helper, transaction }
		) => transaction(async () => {
			const company_id = company.company_id

			await assert_input_ids_valid({ client, address, contact, project, select_builder })

			const creating_new_client = client.client_id === null
			const use_project_address_as_billing_address = creating_new_client && !billing_address

			const client_id = await upsert_client({
				client,
				billing_address: use_project_address_as_billing_address ? address_to_billing_address(client.name, address) : billing_address,
				company_id,
				write_helper,
			})

			if (creating_new_client) {
				assert(address.client_address_id === null)
				assert(contact.client_contact_id === null)
			}

			const client_address_id = await upsert_client_address({
				client_id,
				address,
				company_id,
				select_builder,
				write_helper,
			})

			if (creating_new_client) {
				await write_helper.update('client', 'client_id', client_id, {
					default_project_address_id: client_address_id,
				})
			}

			const client_contact_id = await upsert_client_contact({ client_id, contact, company_id, select_builder, write_helper })

			const lead_source_id = project.lead_source_id === null && project.lead_source_name
				? await insert_lead_source({
					lead_source_name: project.lead_source_name,
					company_id,
					select_builder,
					write_helper,
				})
				: project.lead_source_id

			const initial_project_document_id = await get_lead_project_document_id({ select_builder })

			const project_number = await get_next_project_number_and_increment({ company_id, write_helper })

			const { insert_id: project_id } = await write_helper.insert('project', {
				company_id,
				number: project_number,
				project_document_id: initial_project_document_id,
				client_id,
				client_address_id,
				client_contact_id,
				address_line_1: address.address_line_1,
				address_line_2: address.address_line_2,
				city: address.city,
				state: address.state,
				zip: address.zip,
				due_date: project.due_date,
				emergency: project.emergency,
				lead_details: project.lead_details,
				lead_source_id,
				assigned_estimator_employee_id: project.assigned_estimator_employee_id,
				discount_description: '',
				notes_for_crew: project.notes_for_crew,
				notes_for_office: project.notes_for_office,
				created_by_employee_id: user.employee_id,
				needs_client_approval: false,
				sent_for_client_approval: false,
				taxable: false,
				closed: false,
			})

			await write_helper.insert('project_document_history', {
				company_id,
				project_id,
				project_document_id: initial_project_document_id,
				changed_by_employee_id: user.employee_id,
			})

			if (availability.length > 0) {
				await write_helper.bulk_insert('estimate_availability', map(availability, ({
					availability_date,
					start_time,
					end_time,
				}) => ({
					company_id,
					project_id,
					availability_date,
					start_time,
					end_time,
				})), 100)
			}

			return { project_id, client_id }
		}),
	}),
}
