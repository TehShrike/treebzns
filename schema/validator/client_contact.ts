import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from '#shared/value_validators.ts'
import type { ArbostarEmailData } from '#schema/type/client_contact.d.ts'

const zero_or_one = jv.one_of(jv.exact(0 as const), jv.exact(1 as const))

export const arbostar_email_data_validator: Validator<ArbostarEmailData> = jv.object({
	email_check: jv.nullable(zero_or_one),
	email_manual_approve: zero_or_one,
	email_blocked: jv.is_boolean,
	email_blocked_reason: jv.nullable(jv.one_of(jv.exact('COMPLAINT' as const), jv.exact('BOUNCE' as const))),
	email_blocked_date: jv.nullable(jv.is_string),
	email_unsubscribed: jv.is_boolean,
	email_unsubscribe: jv.nullable(jv.object({
		email: jv.is_string,
		documentation: jv.is_boolean,
		informational: jv.is_boolean,
		reason: jv.is_null,
	})),
})

export const validator_object = {
	client_contact_id: jv.is_bigint,
	company_id: jv.is_bigint,
	client_id: jv.is_bigint,
	description: jv.is_string,
	name: jv.is_string,
	phone: jv.is_string,
	email: jv.is_string,
	arbostar_email_data: jv.nullable(arbostar_email_data_validator),
	is_primary: jv.is_boolean,
	sort: jv.is_bigint,
	arbostar_contact_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const client_contact_validator: Validator<DbClientContact> = jv.object(validator_object)

export const insertable_client_contact_validator: Validator<DbInsertableClientContact> = jv.object(omit(validator_object, ['client_contact_id', 'created_at', 'updated_at']))
