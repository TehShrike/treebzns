import * as jv from '#shared/json_validator.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import { is_temporal_plain_date, is_temporal_plain_time } from '#schema/validator/_helpers.ts'
import { fns } from '#shared/sql_request/mysql_function.ts'
import assert from '#shared/assert.ts'
import { map, reduce } from '#shared/array.ts'
import type { Context } from '#worker/lib/context.ts'
import type { LeadClient, LeadBilling, LeadAddress, LeadContact } from '#shared/type/lead.ts'

const create_lead_validator: jv.Validator<{
	client: LeadClient
	billing: LeadBilling | null
	address: LeadAddress
	contact: LeadContact
	lead_details: DbProject['lead_details']
	lead_source_name: string
	assigned_estimator_employee_id: DbProject['assigned_estimator_employee_id']
	due_date: DbProject['due_date']
	emergency: DbProject['emergency']
	notes_for_office: DbProject['notes_for_office']
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
	billing: jv.nullable(jv.object({
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
	lead_details: jv.is_string,
	lead_source_name: jv.is_string,
	assigned_estimator_employee_id: jv.nullable(jv.is_bigint),
	due_date: jv.nullable(is_temporal_plain_date),
	emergency: jv.is_boolean,
	notes_for_office: jv.is_string,
	availability: jv.array(jv.object({
		availability_date: is_temporal_plain_date,
		start_time: is_temporal_plain_time,
		end_time: is_temporal_plain_time,
	})),
})

const create_new_client = async ({
	client,
	billing,
	address,
	contact,
	company,
	write_helper,
}: {
	client: LeadClient
	billing: LeadBilling | null
	address: LeadAddress
	contact: LeadContact
	company: Context['company']
	write_helper: Context['write_helper']
}): Promise<bigint> => {
	assert(address.client_address_id === null, `client_address_id is null when the client is new`)
	assert(contact.client_contact_id === null, `client_contact_id is null when the client is new`)

	const inserted = await write_helper.insert('client', {
		company_id: company.company_id,
		name: client.name,
		is_commercial: client.is_commercial,
		default_project_address_id: 0n,
		billing_name: billing?.billing_name ?? '',
		billing_address_line_1: billing?.billing_address_line_1 ?? '',
		billing_address_line_2: billing?.billing_address_line_2 ?? '',
		billing_city: billing?.billing_city ?? '',
		billing_state: billing?.billing_state ?? '',
		billing_zip: billing?.billing_zip ?? '',
		primary_phone: client.primary_phone,
		primary_email: client.primary_email,
		tax_rate_id: client.tax_rate_id,
		notes: client.notes,
		referred_by: client.referred_by,
	})

	return inserted.insert_id
}

const update_existing_client = async ({
	client_id,
	client,
	billing,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	client: LeadClient
	billing: LeadBilling | null
	select_builder: Context['select_builder']
	write_helper: Context['write_helper']
}): Promise<bigint> => {
	assert(billing === null, `billing is null when the client already exists`)

	const client_query = select_builder
		.from('client')
		.where(q => q.comparison('client.client_id', '=', { value: client_id }))
		.select(() => ['client.client_id'])
		.build()
	const client_row = await select_builder.get_first_row(client_query)
	if (!client_row) {
		throw new Error(`No client found with client_id "${ client_id }"`)
	}

	await write_helper.update('client', 'client_id', client_id, {
		name: client.name,
		is_commercial: client.is_commercial,
		primary_phone: client.primary_phone,
		primary_email: client.primary_email,
		tax_rate_id: client.tax_rate_id,
		notes: client.notes,
		referred_by: client.referred_by,
	})

	return client_id
}

const next_sort = (sorts: readonly bigint[]): bigint => reduce(sorts, 0n, (acc, sort) => (sort >= acc ? sort + 1n : acc))

const create_client_address = async ({
	client_id,
	creating_new_client,
	address,
	company,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	creating_new_client: boolean
	address: LeadAddress
	company: Context['company']
	select_builder: Context['select_builder']
	write_helper: Context['write_helper']
}): Promise<bigint> => {
	const address_sorts_query = select_builder
		.from('client_address')
		.where(q => q.comparison('client_address.client_id', '=', { value: client_id }))
		.select(() => ['client_address.sort'])
		.build()
	const address_rows = await select_builder.get_rows(address_sorts_query)

	const inserted = await write_helper.insert('client_address', {
		company_id: company.company_id,
		client_id,
		client_contact_id: null,
		name: '',
		address_line_1: address.address_line_1,
		address_line_2: address.address_line_2,
		city: address.city,
		state: address.state,
		zip: address.zip,
		sort: next_sort(map(address_rows, row => row.client_address.sort)),
	})
	const client_address_id = inserted.insert_id

	if (creating_new_client) {
		await write_helper.update('client', 'client_id', client_id, {
			default_project_address_id: client_address_id,
		})
	}

	return client_address_id
}

const update_client_address = async ({
	client_address_id,
	client_id,
	address,
	select_builder,
	write_helper,
}: {
	client_address_id: bigint
	client_id: bigint
	address: LeadAddress
	select_builder: Context['select_builder']
	write_helper: Context['write_helper']
}): Promise<bigint> => {
	const address_query = select_builder
		.from('client_address')
		.where(q => q.and(
			q.comparison('client_address.client_address_id', '=', { value: client_address_id }),
			q.comparison('client_address.client_id', '=', { value: client_id }),
		))
		.select(() => ['client_address.client_address_id'])
		.build()
	const address_row = await select_builder.get_first_row(address_query)
	if (!address_row) {
		throw new Error(`No client_address found with client_address_id "${ client_address_id }" for client_id "${ client_id }"`)
	}

	await write_helper.update('client_address', 'client_address_id', client_address_id, {
		address_line_1: address.address_line_1,
		address_line_2: address.address_line_2,
		city: address.city,
		state: address.state,
		zip: address.zip,
	})

	return client_address_id
}

const create_client_contact = async ({
	client_id,
	contact,
	company,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	contact: LeadContact
	company: Context['company']
	select_builder: Context['select_builder']
	write_helper: Context['write_helper']
}): Promise<void> => {
	const contact_sorts_query = select_builder
		.from('client_contact')
		.where(q => q.comparison('client_contact.client_id', '=', { value: client_id }))
		.select(() => ['client_contact.sort'])
		.build()
	const contact_rows = await select_builder.get_rows(contact_sorts_query)

	await write_helper.insert('client_contact', {
		company_id: company.company_id,
		client_id,
		description: '',
		name: contact.name,
		phone: contact.phone,
		email: contact.email,
		is_primary: contact_rows.length === 0,
		sort: next_sort(map(contact_rows, row => row.client_contact.sort)),
	})
}

const update_client_contact = async ({
	client_contact_id,
	client_id,
	contact,
	select_builder,
	write_helper,
}: {
	client_contact_id: bigint
	client_id: bigint
	contact: LeadContact
	select_builder: Context['select_builder']
	write_helper: Context['write_helper']
}): Promise<void> => {
	const contact_query = select_builder
		.from('client_contact')
		.where(q => q.and(
			q.comparison('client_contact.client_contact_id', '=', { value: client_contact_id }),
			q.comparison('client_contact.client_id', '=', { value: client_id }),
		))
		.select(() => ['client_contact.client_contact_id'])
		.build()
	const contact_row = await select_builder.get_first_row(contact_query)
	if (!contact_row) {
		throw new Error(`No client_contact found with client_contact_id "${ client_contact_id }" for client_id "${ client_id }"`)
	}

	await write_helper.update('client_contact', 'client_contact_id', client_contact_id, {
		name: contact.name,
		phone: contact.phone,
		email: contact.email,
	})
}

export const functions = {
	create_lead: sfn({
		validator: create_lead_validator,
		fn: (arg, context): Promise<{ project_id: bigint, client_id: bigint }> => context.transaction(async () => {
			const { company, user, select_builder, write_helper } = context
			const company_id = company.company_id
			const { client, billing, address, contact } = arg

			let client_id: bigint
			const creating_new_client = client.client_id === null

			if (client.client_id === null) {
				client_id = await create_new_client({ client, billing, address, contact, company, write_helper })
			} else {
				client_id = await update_existing_client({
					client_id: client.client_id,
					client,
					billing,
					select_builder,
					write_helper,
				})
			}

			let client_address_id: bigint
			if (address.client_address_id === null) {
				client_address_id = await create_client_address({
					client_id,
					creating_new_client,
					address,
					company,
					select_builder,
					write_helper,
				})
			} else {
				client_address_id = await update_client_address({
					client_address_id: address.client_address_id,
					client_id,
					address,
					select_builder,
					write_helper,
				})
			}

			if (contact.client_contact_id === null) {
				await create_client_contact({ client_id, contact, company, select_builder, write_helper })
			} else {
				await update_client_contact({
					client_contact_id: contact.client_contact_id,
					client_id,
					contact,
					select_builder,
					write_helper,
				})
			}

			const lead_source_name = arg.lead_source_name.trim()
			let lead_source_id: bigint | null = null
			if (lead_source_name !== '') {
				const lead_source_query = select_builder
					.from('lead_source')
					.where(q => q.comparison('lead_source.name', '=', { value: lead_source_name }))
					.select(() => ['lead_source.lead_source_id'])
					.build()
				const lead_source_row = await select_builder.get_first_row(lead_source_query)
				if (lead_source_row) {
					lead_source_id = lead_source_row.lead_source.lead_source_id
				} else {
					const inserted = await write_helper.insert('lead_source', {
						company_id,
						name: lead_source_name,
					})
					lead_source_id = inserted.insert_id
				}
			}

			if (arg.assigned_estimator_employee_id !== null) {
				const employee_query = select_builder
					.from('employee')
					.where(q => q.comparison('employee.employee_id', '=', { value: arg.assigned_estimator_employee_id }))
					.select(() => ['employee.employee_id'])
					.build()
				const employee_row = await select_builder.get_first_row(employee_query)
				if (!employee_row) {
					throw new Error(`No employee found with employee_id "${ arg.assigned_estimator_employee_id }"`)
				}
			}

			// The initial document is the lowest-sort project_document — the same rule
			// create_company used when this lived on company.default_initial_project_document_id.
			const initial_document_query = select_builder
				.from('project_document')
				.order_by('project_document.sort', 'ASC')
				.limit(1n)
				.select(() => ['project_document.project_document_id'])
				.build()
			const initial_document_row = await select_builder.get_first_row(initial_document_query)
			if (!initial_document_row) {
				throw new Error('No project_document rows exist to use as the initial project document')
			}
			const initial_project_document_id = initial_document_row.project_document.project_document_id

			// LAST_INSERT_ID(expr) makes the taken number readable from this UPDATE's insert_id,
			// so no second query or explicit lock is needed — the UPDATE's own row lock is what
			// makes each number claimable by only one transaction.
			const { insert_id: number } = await write_helper.update('project_number', 'company_id', company_id, {
				next_number: fns.last_insert_id_increment('next_number', 1n),
			})
			if (number === 0n) {
				throw new Error(`No project_number row exists for company "${ company_id }"`)
			}

			const { insert_id: project_id } = await write_helper.insert('project', {
				company_id,
				number,
				project_document_id: initial_project_document_id,
				client_id,
				client_address_id,
				address_line_1: address.address_line_1,
				address_line_2: address.address_line_2,
				city: address.city,
				state: address.state,
				zip: address.zip,
				contact_name: contact.name,
				contact_phone: contact.phone,
				contact_email: contact.email,
				due_date: arg.due_date,
				emergency: arg.emergency,
				lead_details: arg.lead_details,
				lead_source_id,
				assigned_estimator_employee_id: arg.assigned_estimator_employee_id,
				discount_description: '',
				notes_for_crew: '',
				notes_for_office: arg.notes_for_office,
				created_by_employee_id: user.employee_id,
				needs_client_approval: false,
				sent_for_client_approval: false,
				taxable: false,
				closed: false,
			})

			if (arg.availability.length > 0) {
				await write_helper.bulk_insert('estimate_availability', map(arg.availability, window => ({
					company_id,
					project_id,
					availability_date: window.availability_date,
					start_time: window.start_time,
					end_time: window.end_time,
				})), 100)
			}

			return { project_id, client_id }
		}),
	}),
}
