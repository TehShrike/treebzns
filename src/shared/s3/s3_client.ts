import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'
import { empty_payload_hash, presign_url, sign_request, unsigned_payload, uri_encode, type S3Credentials } from './sign.ts'

export type S3ClientOptions = S3Credentials & {
	endpoint: string
}

export type S3ObjectHead = {
	content_length: number
	content_type: string
	etag: string
}

type S3Method = `GET` | `HEAD` | `PUT` | `DELETE`

const response_error = async (response: Response, description: string) =>
	new Error(`${description} responded ${response.status}: ${await response.text()}`)

export const create_s3_client = ({ endpoint, ...credentials }: S3ClientOptions) => {
	const object_url = (key: string) => {
		assert(key.length > 0 && !key.startsWith(`/`), `Object key is not empty and does not start with a slash`)
		return new URL(`${endpoint}/${map(key.split(`/`), uri_encode).join(`/`)}`)
	}

	const signed_fetch = async ({
		method,
		key,
		headers = {},
		payload_hash = empty_payload_hash,
		body = null,
	}: {
		method: S3Method
		key: string
		headers?: Record<string, string>
		payload_hash?: string
		body?: Blob | Uint8Array<ArrayBuffer> | null
	}) => {
		const url = object_url(key)
		const signed_headers = await sign_request({ credentials, method, url, headers, payload_hash })
		return fetch(url, { method, headers: signed_headers, body })
	}

	return {
		put_object: async ({
			key,
			body,
			content_type,
		}: {
			key: string
			body: Blob | Uint8Array<ArrayBuffer>
			content_type: string
		}): Promise<void> => {
			const response = await signed_fetch({
				method: `PUT`,
				key,
				headers: { 'content-type': content_type },
				payload_hash: unsigned_payload,
				body,
			})
			if (!response.ok) throw await response_error(response, `PUT ${key}`)
			await response.text()
		},
		get_object: async ({ key }: { key: string }): Promise<Response | null> => {
			const response = await signed_fetch({ method: `GET`, key })
			if (response.status === 404) {
				await response.text()
				return null
			}
			if (!response.ok) throw await response_error(response, `GET ${key}`)
			return response
		},
		head_object: async ({ key }: { key: string }): Promise<S3ObjectHead | null> => {
			const response = await signed_fetch({ method: `HEAD`, key })
			if (response.status === 404) return null
			if (!response.ok) throw new Error(`HEAD ${key} responded ${response.status}`)
			return {
				content_length: Number(response.headers.get(`content-length`)),
				content_type: response.headers.get(`content-type`) ?? ``,
				etag: response.headers.get(`etag`) ?? ``,
			}
		},
		delete_object: async ({ key }: { key: string }): Promise<void> => {
			const response = await signed_fetch({ method: `DELETE`, key })
			if (!response.ok) throw await response_error(response, `DELETE ${key}`)
			await response.text()
		},
		presign_url: ({
			key,
			method = `GET`,
			expires_in_seconds,
			date,
		}: {
			key: string
			method?: S3Method
			expires_in_seconds: number
			date?: Date
		}): Promise<string> => presign_url({
			credentials,
			method,
			url: object_url(key),
			expires_in_seconds,
			...(date ? { date } : {}),
		}),
	}
}

export type S3Client = ReturnType<typeof create_s3_client>
