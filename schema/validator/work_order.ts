import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant, is_temporal_plain_date, is_temporal_plain_time } from '#shared/value_validators.ts'

export const validator_object = {
	work_order_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	crew_id: jv.is_bigint,
	work_date: is_temporal_plain_date,
	arbostar_schedule_event_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

const ordered = { day_order: jv.is_bigint, start_time: jv.is_null }
const fixed_time = { day_order: jv.is_null, start_time: is_temporal_plain_time }

export const work_order_validator: Validator<DbWorkOrder> = jv.one_of(
	jv.object({ ...validator_object, ...ordered }),
	jv.object({ ...validator_object, ...fixed_time }),
)

const insertable_validator_object = omit(validator_object, ['work_order_id', 'created_at', 'updated_at'])

export const insertable_work_order_validator: Validator<DbInsertableWorkOrder> = jv.one_of(
	jv.object({ ...insertable_validator_object, ...ordered }),
	jv.object({ ...insertable_validator_object, ...fixed_time }),
)
