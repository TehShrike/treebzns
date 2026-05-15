const encoder = new TextEncoder()

export const password_hash = async (password: string, salt: bigint, iterations: number): Promise<ArrayBuffer> => {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	)

	const salt_bytes = new Uint8Array(8)
	new DataView(salt_bytes.buffer).setBigUint64(0, salt)

	return crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-256',
			salt: salt_bytes,
			iterations,
		},
		key,
		256,
	)
}
