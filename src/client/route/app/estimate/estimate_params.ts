import param_validator from '#shared/param_validator.ts'

export const validate_estimate_params = param_validator({
	project_id: param_validator.bigint,
})
