import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

const permission_code_validator = jv.one_of(
	jv.exact('CAN_CHANGE_WORK_ORDERS_WITHOUT_CUSTOMER_APPROVAL' as const),
	jv.exact('CAN_CREATE_CLIENT' as const),
	jv.exact('CAN_CREATE_ORDER' as const),
	jv.exact('CAN_EDIT_CLIENT' as const),
	jv.exact('CAN_EDIT_PAYMENTS' as const),
	jv.exact('CAN_ESTIMATE' as const),
	jv.exact('CAN_MANAGE_USERS' as const),
	jv.exact('CAN_QUALIFY_LEAD' as const),
	jv.exact('CAN_SET_ANY_DOCUMENT_STATUS' as const),
	jv.exact('CAN_WORK_PROJECTS' as const),
)

export const validator_object = {
	permission_id: jv.is_bigint,
	code: permission_code_validator,
	name: jv.is_string,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const permission_validator: jv.Validator<DbPermission> = jv.object(validator_object)

export const insertable_permission_validator: jv.Validator<DbInsertablePermission> = jv.object(omit(validator_object, ['permission_id', 'created_at', 'updated_at']))
