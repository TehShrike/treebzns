import assert from '#shared/assert.ts'

export default (identifier: string): string => {
	assert(/^\w+$/.test(identifier), `A SQL identifier contains only letters, numbers, and underscores: ${JSON.stringify(identifier)}`)
	return `\`${identifier}\``
}
