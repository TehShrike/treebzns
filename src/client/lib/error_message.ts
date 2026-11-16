const message_of = (value: unknown): string | null => (
	typeof value === `object` && value !== null && `message` in value && typeof value.message === `string` && value.message !== ``
		? value.message
		: null
)

const body_of = (value: unknown): unknown => (
	typeof value === `object` && value !== null && `body` in value ? value.body : null
)

const error_message = (error: unknown): string => {
	if (typeof error === `string` && error !== ``) {
		return error
	}

	return message_of(body_of(error)) ?? message_of(error) ?? `Something went wrong`
}

export default error_message
