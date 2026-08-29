const is_duplicate_key_error = (error: unknown): boolean =>
	!!error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY'

export default is_duplicate_key_error
