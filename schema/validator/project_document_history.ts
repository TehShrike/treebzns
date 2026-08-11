import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	project_document_history_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	project_document_id: jv.is_bigint,
	changed_by_employee_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
}

export const project_document_history_validator: jv.Validator<DbProjectDocumentHistory> = jv.object(validator_object)

export const insertable_project_document_history_validator: jv.Validator<DbInsertableProjectDocumentHistory> = jv.object(omit(validator_object, ['project_document_history_id', 'created_at']))
