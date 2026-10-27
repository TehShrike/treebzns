import { Temporal } from '@js-temporal/polyfill'
import jv, { type Validator } from '#shared/json_validator.ts'
import { sfn } from '#lib/server_functions_api.ts'
import { is_temporal_plain_date, is_temporal_plain_time } from '#shared/value_validators.ts'
import get_next_project_number_and_increment from '#lib/db/get_next_project_number_and_increment.ts'
import { get_lead_needing_estimate_project_document_id } from '#lib/db/project_document.ts'
import assert_db_id_valid from '#lib/db/assert_db_id_valid.ts'
import { upsert_client } from './lead_helper/client.ts'
import { upsert_client_address } from './lead_helper/client_address.ts'
import { upsert_client_contact } from './lead_helper/client_contact.ts'
import { insert_lead_source } from './lead_helper/lead_source.ts'
import { filter_map, for_each_parallel, map } from '#shared/array.ts'
import { pick } from '#shared/pick.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import type { TenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { LeadClient, LeadBilling, LeadAddress, LeadAddressValues, LeadContact, CreateLeadArgument, CreateLeadResult } from '#shared/type/lead.ts'

const project_field_validators = {
	due_date: jv.nullable(is_temporal_plain_date),
	emergency: jv.is_boolean,
	lead_details: jv.is_string,
	notes_for_crew: jv.is_string,
	notes_for_office: jv.is_string,
	assigned_estimator_employee_id: jv.nullable(jv.is_bigint),
}

const client_value_validators = {
	name: jv.is_string,
	billing_phone: jv.is_string,
	billing_email: jv.is_string,
	referred_by: jv.is_string,
	tax_rate_id: jv.nullable(jv.is_bigint),
	is_commercial: jv.is_boolean,
	notes: jv.is_string,
}

const address_value_validators = {
	address_line_1: jv.is_string,
	address_line_2: jv.is_string,
	city: jv.is_string,
	state: jv.is_string,
	zip: jv.is_string,
}

const contact_value_validators = {
	name: jv.is_string,
	phone: jv.is_string,
	email: jv.is_string,
}

const create_lead_validator: Validator<CreateLeadArgument> = jv.object({
	client: jv.one_of(
		jv.object({ client_id: jv.is_null, ...client_value_validators }),
		jv.object({ client_id: jv.is_bigint, ...jv.optional_shape(client_value_validators) }),
	),
	billing_address: jv.nullable(jv.object({
		billing_name: jv.is_string,
		billing_address_line_1: jv.is_string,
		billing_address_line_2: jv.is_string,
		billing_city: jv.is_string,
		billing_state: jv.is_string,
		billing_zip: jv.is_string,
	})),
	address: jv.one_of(
		jv.object({ client_address_id: jv.is_null, ...address_value_validators }),
		jv.object({ client_address_id: jv.is_bigint, ...jv.optional_shape(address_value_validators) }),
	),
	contact: jv.one_of(
		jv.object({ client_contact_id: jv.is_null, ...contact_value_validators }),
		jv.object({ client_contact_id: jv.is_bigint, ...jv.optional_shape(contact_value_validators) }),
	),
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
	client.tax_rate_id != null && assert_db_id_valid({ select_builder, table_name: 'tax_rate', id: client.tax_rate_id }),
	address.client_address_id !== null && assert_db_id_valid({ select_builder, table_name: 'client_address', id: address.client_address_id }),
	contact.client_contact_id !== null && assert_db_id_valid({ select_builder, table_name: 'client_contact', id: contact.client_contact_id }),
	project.lead_source_id !== null && assert_db_id_valid({ select_builder, table_name: 'lead_source', id: project.lead_source_id }),
	project.assigned_estimator_employee_id !== null && assert_db_id_valid({ select_builder, table_name: 'employee', id: project.assigned_estimator_employee_id }),
])

const address_to_billing_address = (name: string, address: LeadAddressValues): LeadBilling => ({
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
			{ company, user, transaction }
		): Promise<CreateLeadResult> => transaction(async ({ select_builder, write_helper }) => {
			await assert_input_ids_valid({ client, address, contact, project, select_builder })

			const creating_new_client = client.client_id === null

			const { client_address_id, address: all_address_values } = await upsert_client_address({
				client_id: creating_new_client ? 0n : client.client_id,
				address,
				select_builder,
				write_helper,
			})

			const use_project_address_as_billing_address = creating_new_client && !billing_address
			const client_id = await upsert_client({
				client: creating_new_client ? {...client, default_project_address_id: client_address_id} : client,
				billing_address: use_project_address_as_billing_address ? address_to_billing_address(client.name, all_address_values) : billing_address,
				write_helper,
			})

			if (creating_new_client) {
				await write_helper.update({ table_name: 'client_address', column: 'client_address_id', value: client_address_id, set: { client_id } })
			}

			const client_contact_id = await upsert_client_contact({ client_id, contact, select_builder, write_helper })

			const lead_source_id = project.lead_source_id === null && project.lead_source_name
				? await insert_lead_source({
					lead_source_name: project.lead_source_name,
					select_builder,
					write_helper,
				})
				: project.lead_source_id

			const initial_project_document_id = await get_lead_needing_estimate_project_document_id({ select_builder })

			const project_number = await get_next_project_number_and_increment({ write_helper })

			const now = Temporal.Now.instant()
			const change_date = now.toZonedDateTimeISO(company.timezone).toPlainDate()

			const { insert_id: project_id } = await write_helper.insert('project', {
				...default_values.project,
				...all_address_values,
				number: project_number,
				project_document_id: initial_project_document_id,
				last_project_document_change_date: change_date,
				last_project_document_change_datetime: now,
				client_id,
				client_address_id,
				client_contact_id,
				...pick(project, ['due_date', 'emergency', 'lead_details', 'assigned_estimator_employee_id', 'notes_for_crew', 'notes_for_office']),
				lead_source_id,
				created_by_employee_id: user.employee_id,
			})

			await write_helper.insert('project_document_history', {
				project_id,
				project_document_id: initial_project_document_id,
				changed_by_employee_id: user.employee_id,
				change_date,
				change_datetime: now,
			})

			if (availability.length > 0) {
				await write_helper.bulk_insert('estimate_availability', map(availability, ({
					availability_date,
					start_time,
					end_time,
				}) => ({
					project_id,
					availability_date,
					start_time,
					end_time,
				})), 100)
			}

			return { project_id, client_id, client_address_id, client_contact_id }
		}),
	}),
}
