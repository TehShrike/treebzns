import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from '#shared/value_validators.ts'

const expires = { can_expire: jv.exact<true>(true), expire_days: jv.is_bigint } as const
const never_expires = { can_expire: jv.exact<false>(false), expire_days: jv.is_null } as const

export const validator_object = {
	project_document_id: jv.is_bigint,
	name: jv.is_string,
	needs_estimate_to_move_on: jv.is_boolean,
	needs_client_approval_to_move_on: jv.is_boolean,
	next_project_document_id: jv.nullable(jv.is_bigint),
	should_be_worked: jv.is_boolean,
	needs_to_be_contacted_by_lead_qualifier: jv.is_boolean,
	represents_billable_sale_when_closed: jv.is_boolean,
	declined: jv.is_boolean,
	closed_by_default: jv.is_boolean,
	declined_project_document_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
	sort: jv.is_bigint,
}

export const project_document_validator: Validator<DbProjectDocument> = jv.one_of(
	jv.object({ ...validator_object, ...expires }),
	jv.object({ ...validator_object, ...never_expires }),
)

const insertable_validator_object = omit(validator_object, ['project_document_id', 'created_at', 'updated_at'])

export const insertable_project_document_validator: Validator<DbInsertableProjectDocument> = jv.one_of(
	jv.object({ ...insertable_validator_object, ...expires }),
	jv.object({ ...insertable_validator_object, ...never_expires }),
)
