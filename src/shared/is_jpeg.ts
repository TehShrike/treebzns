export const is_jpeg = (bytes: Uint8Array): boolean =>
	bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
