import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	migration_id: jv.is_bigint,
	migration_number: jv.is_bigint,
	ran_at: is_temporal_instant,
}

export const migration_validator: jv.Validator<DbMigration> = jv.object(validator_object)

export const insertable_migration_validator: jv.Validator<DbInsertableMigration> = jv.object(omit(validator_object, ['migration_id']))
