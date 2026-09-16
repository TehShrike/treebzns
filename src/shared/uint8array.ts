const base64_chunk_size = 0x8000

export const uint8array_to_base64 = (uint8array: Uint8Array): string => {
	let binary = ``
	for (let offset = 0; offset < uint8array.length; offset += base64_chunk_size) {
		binary += String.fromCharCode(...uint8array.subarray(offset, offset + base64_chunk_size))
	}
	return btoa(binary)
}

export const base64_to_uint8array = (base64: string): Uint8Array =>
	Uint8Array.from(atob(base64), character => character.charCodeAt(0))
