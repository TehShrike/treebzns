import { Temporal } from '@js-temporal/polyfill'
import * as jv from '#shared/json_validator.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import { is_temporal_plain_date, is_temporal_plain_time } from '#schema/validator/_helpers.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import safe_query_builder from '#shared/treebzns_db/safe_query_builder.ts'
import write_helper from '#worker/lib/mysql/write_helper.ts'
import { transaction } from '#worker/lib/mysql/helpers.ts'
import { map, some, for_each } from '#shared/array.ts'
import type { Schema } from '#schema/types.ts'
import type { Context } from '#worker/lib/context.ts'

const client_fields_validator = jv.object({
	name: jv.is_string,
	is_commercial: jv.is_boolean,
	primary_phone: jv.is_string,
	primary_email: jv.is_string,
	tax_rate_id: jv.nullable(jv.is_bigint),
	notes: jv.is_string,
	referred_by: jv.is_string,
})

const address_fields_validator = jv.object({
	address_line_1: jv.is_string,
	address_line_2: jv.is_string,
	city: jv.is_string,
	state: jv.is_string,
	zip: jv.is_string,
})

const availability_window_validator = jv.object({
	availability_date: is_temporal_plain_date,
	start_time: is_temporal_plain_time,
	end_time: is_temporal_plain_time,
})

const create_lead_validator = jv.object({
	client_id: jv.nullable(jv.is_bigint),
	client: client_fields_validator,
	client_address_id: jv.nullable(jv.is_bigint),
	address: address_fields_validator,
	contact_name: jv.is_string,
	contact_phone: jv.is_string,
	contact_email: jv.is_string,
	project_document_id: jv.is_bigint,
	lead_details: jv.is_string,
	lead_source: jv.is_string,
	emergency: jv.is_boolean,
	due_date: jv.nullable(is_temporal_plain_date),
	assigned_estimator_employee_id: jv.nullable(jv.is_bigint),
	notes_for_office: jv.is_string,
	availability: jv.array(availability_window_validator),
})

type CreateLeadArg = jv.InferValidator<typeof create_lead_validator>

const assert_lead_document = async (mysql: Context['mysql'], project_document_id: bigint) => {
	// The lead documents are the two lowest-sort project_documents — the same rule the
	// design uses to fill the status dropdown.
	const lead_documents_query = query_builder<Schema>()
		.from('project_document')
		.order_by('project_document.sort', 'ASC')
		.limit(2n)
		.select(() => ['project_document.project_document_id'])
		.build()
	const lead_document_rows = await mysql.query(safe_query_builder.to_sql(lead_documents_query.query)).get_rows()
	const lead_document_ids = map(lead_document_rows, row => lead_documents_query.positional_row_to_named(row).project_document.project_document_id)

	if (!some(lead_document_ids, lead_document_id => lead_document_id === project_document_id)) {
		throw new Error(`project_document_id "${ project_document_id }" is not one of the lead documents`)
	}
}

const upsert_client = async (mysql: Context['mysql'], company_id: bigint, arg: CreateLeadArg): Promise<bigint> => {
	if (arg.client_id === null) {
		const { insert_id } = await write_helper.insert(mysql.connection, 'client', {
			company_id,
			name: arg.client.name,
			is_commercial: arg.client.is_commercial,
			primary_client_address_id: 0n,
			primary_phone: arg.client.primary_phone,
			primary_email: arg.client.primary_email,
			tax_rate_id: arg.client.tax_rate_id,
			notes: arg.client.notes,
			referred_by: arg.client.referred_by,
		})
		return insert_id
	}

	const affected_rows = await mysql.query({
		sql: `UPDATE client
			SET name = ?, is_commercial = ?, primary_phone = ?, primary_email = ?, tax_rate_id = ?, notes = ?, referred_by = ?
			WHERE company_id = ? AND client_id = ?`,
		values: [
			arg.client.name,
			arg.client.is_commercial,
			arg.client.primary_phone,
			arg.client.primary_email,
			arg.client.tax_rate_id,
			arg.client.notes,
			arg.client.referred_by,
			company_id,
			arg.client_id,
		],
	}).get_number_of_affected_rows()

	if (affected_rows === 0n) {
		throw new Error(`No client found with client_id "${ arg.client_id }"`)
	}

	return arg.client_id
}

const resolve_client_address = async (mysql: Context['mysql'], company_id: bigint, client_id: bigint, arg: CreateLeadArg): Promise<bigint> => {
	if (arg.client_address_id === null) {
		const { insert_id } = await write_helper.insert(mysql.connection, 'client_address', {
			company_id,
			client_id,
			name: '',
			address_line_1: arg.address.address_line_1,
			address_line_2: arg.address.address_line_2,
			city: arg.address.city,
			state: arg.address.state,
			zip: arg.address.zip,
			contact: '',
			phone: '',
			email: '',
		})

		if (arg.client_id === null) {
			await mysql.query({
				sql: 'UPDATE client SET primary_client_address_id = ? WHERE company_id = ? AND client_id = ?',
				values: [ insert_id, company_id, client_id ],
			})
		}

		return insert_id
	}

	const address_query = query_builder<Schema>()
		.from('client_address')
		.where(q => q.and(
			q.comparison('client_address.company_id', '=', { value: company_id }),
			q.comparison('client_address.client_id', '=', { value: client_id }),
			q.comparison('client_address.client_address_id', '=', { value: arg.client_address_id }),
		))
		.select(() => ['client_address.client_address_id'])
		.build()
	const address_row = await mysql.query(safe_query_builder.to_sql(address_query.query)).get_first_row()
	if (!address_row) {
		throw new Error(`No client_address found with client_address_id "${ arg.client_address_id }" for client_id "${ client_id }"`)
	}

	return arg.client_address_id
}

export const functions = {
	create_lead: sfn({
		validator: create_lead_validator,
		fn: (arg, context): Promise<Pick<DbProject, 'project_id' | 'number'>> => transaction(context.mysql.connection, async () => {
			const { mysql, company, user } = context
			const company_id = company.company_id

			if (arg.client_id === null && arg.client_address_id !== null) {
				throw new Error('A new client cannot use a saved address')
			}
			for_each(arg.availability, window => {
				if (Temporal.PlainTime.compare(window.start_time, window.end_time) >= 0) {
					throw new Error(`Availability start time "${ window.start_time }" must be before end time "${ window.end_time }"`)
				}
			})

			await assert_lead_document(mysql, arg.project_document_id)

			const client_id = await upsert_client(mysql, company_id, arg)
			const client_address_id = await resolve_client_address(mysql, company_id, client_id, arg)

			// LAST_INSERT_ID(expr) makes the taken number readable from this UPDATE's insertId,
			// so no second query or explicit lock is needed — the UPDATE's own row lock is what
			// makes each number claimable by only one transaction.
			const number = await mysql.query({
				sql: 'UPDATE project_number SET next_number = LAST_INSERT_ID(next_number) + 1 WHERE company_id = ?',
				values: [company_id],
			}).get_insert_id()
			if (number === 0n) {
				throw new Error(`No project_number row exists for company "${ company_id }"`)
			}

			const { insert_id: project_id } = await write_helper.insert(mysql.connection, 'project', {
				company_id,
				number,
				project_document_id: arg.project_document_id,
				client_id,
				client_address_id,
				address_line_1: arg.address.address_line_1,
				address_line_2: arg.address.address_line_2,
				city: arg.address.city,
				state: arg.address.state,
				zip: arg.address.zip,
				contact_name: arg.contact_name || arg.client.name,
				contact_phone: arg.contact_phone || arg.client.primary_phone,
				contact_email: arg.contact_email || arg.client.primary_email,
				due_date: arg.due_date,
				emergency: arg.emergency,
				assigned_estimator_employee_id: arg.assigned_estimator_employee_id,
				lead_details: arg.lead_details,
				lead_source: arg.lead_source,
				notes_for_crew: '',
				notes_for_office: arg.notes_for_office,
				created_by_employee_id: user.employee_id,
				needs_client_approval: false,
				sent_for_client_approval: false,
				taxable: false,
				closed: false,
			})

			await Promise.all(map(arg.availability, window => write_helper.insert(mysql.connection, 'estimate_availability', {
				company_id,
				project_id,
				availability_date: window.availability_date,
				start_time: window.start_time,
				end_time: window.end_time,
			})))

			return { project_id, number }
		}),
	}),
}
