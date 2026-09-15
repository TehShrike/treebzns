import param_validator from '#shared/param_validator.ts'

export const validate_line_item_params = param_validator({
	project_id: param_validator.bigint,
	project_line_item_id: param_validator.bigint,
})
