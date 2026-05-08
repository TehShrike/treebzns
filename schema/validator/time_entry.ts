import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant, is_temporal_plain_date } from './_helpers.ts'

export const validator_object = {
	time_entry_id: jv.is_bigint,
	company_id: jv.is_bigint,
	employee_id: jv.is_bigint,
	project_id: jv.is_bigint,
	work_date: is_temporal_plain_date,
	clock_in: is_temporal_instant,
	clock_out: jv.nullable(is_temporal_instant),
	regular_hours: is_financial_number,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const time_entry_validator: jv.Validator<DbTimeEntry> = jv.object(validator_object)

export const insertable_time_entry_validator: jv.Validator<DbInsertableTimeEntry> = jv.object(omit(validator_object, ['time_entry_id', 'created_at', 'updated_at']))
