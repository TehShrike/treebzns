import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant, is_temporal_plain_date } from './_helpers.ts'

export const validator_object = {
	project_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_document_id: jv.is_bigint,
	number: jv.is_bigint,
	client_id: jv.is_bigint,
	client_address_id: jv.is_bigint,
	address_line_1: jv.is_string,
	address_line_2: jv.nullable(jv.is_string),
	city: jv.is_string,
	state: jv.is_string,
	zip: jv.is_string,
	due_date: jv.nullable(is_temporal_plain_date),
	emergency: jv.is_boolean,
	assigned_estimator_employee_id: jv.nullable(jv.is_bigint),
	lead_details: jv.nullable(jv.is_string),
	created_by_employee_id: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
	needs_client_approval: jv.is_boolean,
	sent_for_client_approval: jv.is_boolean,
	tax_rate_id: jv.nullable(jv.is_bigint),
	tax_rate: jv.nullable(is_financial_number),
	notes_for_crew: jv.nullable(jv.is_string),
	notes_for_office: jv.nullable(jv.is_string),
	closed: jv.is_boolean,
	closed_at: jv.nullable(is_temporal_instant),
	closed_date: jv.nullable(is_temporal_plain_date),
	lead_source: jv.nullable(jv.is_string),
}

export const project_validator: jv.Validator<DbProject> = jv.object(validator_object)

export const insertable_project_validator: jv.Validator<DbInsertableProject> = jv.object(omit(validator_object, ['project_id', 'created_at', 'updated_at']))
