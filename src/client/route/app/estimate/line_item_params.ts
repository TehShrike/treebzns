import param_validator from '#shared/param_validator.ts'

export type LineItemIdParam = bigint | `new`

const bigint_or_new = (input: string | string[] | undefined, name: string): LineItemIdParam => input === `new`
	? `new`
	: param_validator.bigint(input, name)

export const validate_line_item_params = param_validator({
	project_id: param_validator.bigint,
	project_line_item_id: bigint_or_new,
})

export const validate_line_item_photo_params = param_validator({
	project_id: param_validator.bigint,
	project_line_item_id: param_validator.bigint,
	project_image_id: param_validator.bigint,
})
