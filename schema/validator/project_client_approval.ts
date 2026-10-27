import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from '#shared/value_validators.ts'
import { is_buffer } from '#shared/value_validators_node.ts'

export const validator_object = {
	project_client_approval_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	customer_signature: jv.nullable(is_buffer),
	verbal_approval: jv.is_boolean,
	added_by_employee_id: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_client_approval_validator: Validator<DbProjectClientApproval> = jv.object(validator_object)

export const insertable_project_client_approval_validator: Validator<DbInsertableProjectClientApproval> = jv.object(omit(validator_object, ['project_client_approval_id', 'created_at', 'updated_at']))
