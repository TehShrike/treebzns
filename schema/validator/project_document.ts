import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	project_document_id: jv.is_bigint,
	name: jv.is_string,
	needs_estimate_to_move_on: jv.is_boolean,
	needs_client_approval_to_move_on: jv.is_boolean,
	can_expire: jv.is_boolean,
	expire_days: jv.nullable(jv.is_bigint),
	next_project_document_id: jv.nullable(jv.is_bigint),
	should_be_worked: jv.is_boolean,
	needs_to_be_contacted_by_lead_qualifier: jv.is_boolean,
	represents_billable_sale_when_closed: jv.is_boolean,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
	sort: jv.is_boolean,
}

export const project_document_validator: jv.Validator<DbProjectDocument> = jv.object(validator_object)

export const insertable_project_document_validator: jv.Validator<DbInsertableProjectDocument> = jv.object(omit(validator_object, ['project_document_id', 'created_at', 'updated_at']))
