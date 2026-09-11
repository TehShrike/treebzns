import param_validator from '#shared/param_validator.ts'

export const validate_project_search_params = param_validator({
	project_document_ids: param_validator.optional(param_validator.array(param_validator.bigint)),
	open_or_closed: param_validator.optional(param_validator.one_of(`open`, `closed`)),
	needs_client_approval: param_validator.optional(param_validator.boolean),
})

export type ProjectSearchParams = ReturnType<typeof validate_project_search_params>
