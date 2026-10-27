import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from '#shared/value_validators.ts'

export const validator_object = {
	project_decline_reason_id: jv.is_bigint,
	company_id: jv.is_bigint,
	reason: jv.is_string,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_decline_reason_validator: Validator<DbProjectDeclineReason> = jv.object(validator_object)

export const insertable_project_decline_reason_validator: Validator<DbInsertableProjectDeclineReason> = jv.object(omit(validator_object, ['project_decline_reason_id', 'created_at', 'updated_at']))
