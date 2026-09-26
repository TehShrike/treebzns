import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'

export type S3Credentials = {
	region: string
	access_key_id: string
	secret_access_key: string
}

export const unsigned_payload = `UNSIGNED-PAYLOAD`
export const empty_payload_hash = `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

const algorithm = `AWS4-HMAC-SHA256`
const max_presign_expires_in_seconds = 7 * 24 * 60 * 60
const text_encoder = new TextEncoder()

const to_hex = (buffer: ArrayBuffer): string => {
	const bytes = new Uint8Array(buffer)
	let hex = ``
	for (let i = 0; i < bytes.length; i++) {
		hex += bytes[i]!.toString(16).padStart(2, `0`)
	}
	return hex
}

export const sha256_hex = async (data: string | Uint8Array<ArrayBuffer>): Promise<string> =>
	to_hex(await crypto.subtle.digest(`SHA-256`, typeof data === `string` ? text_encoder.encode(data) : data))

const hmac = async (key: ArrayBuffer | Uint8Array<ArrayBuffer>, data: string): Promise<ArrayBuffer> => {
	const crypto_key = await crypto.subtle.importKey(`raw`, key, { name: `HMAC`, hash: `SHA-256` }, false, [`sign`])
	return crypto.subtle.sign(`HMAC`, crypto_key, text_encoder.encode(data))
}

export const uri_encode = (value: string): string =>
	encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)

const format_amz_date = (date: Date): string => date.toISOString().replace(/[-:]/g, ``).replace(/\.\d{3}/, ``)

const canonical_uri = (pathname: string): string =>
	map(pathname.split(`/`), segment => uri_encode(decodeURIComponent(segment))).join(`/`)

type QueryPair = [string, string]

const parse_query = (search: string): QueryPair[] => {
	if (search.length <= 1) return []
	return map(search.slice(1).split(`&`), (pair): QueryPair => {
		const equals_index = pair.indexOf(`=`)
		return equals_index === -1
			? [decodeURIComponent(pair), ``]
			: [decodeURIComponent(pair.slice(0, equals_index)), decodeURIComponent(pair.slice(equals_index + 1))]
	})
}

const compare_strings = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

const canonical_query = (pairs: readonly QueryPair[]): string => {
	const encoded_pairs = map(pairs, ([key, value]): QueryPair => [uri_encode(key), uri_encode(value)])
		.sort(([key_a, value_a], [key_b, value_b]) => compare_strings(key_a, key_b) || compare_strings(value_a, value_b))
	return map(encoded_pairs, ([key, value]) => `${key}=${value}`).join(`&`)
}

const canonical_headers = (headers: Record<string, string>) => {
	const names = Object.keys(headers).sort(compare_strings)
	return {
		canonical: map(names, name => `${name}:${headers[name]!.trim().replace(/\s+/g, ` `)}\n`).join(``),
		signed_headers: names.join(`;`),
	}
}

const lowercase_header_names = (headers: Record<string, string>): Record<string, string> =>
	Object.fromEntries(map(Object.entries(headers), ([name, value]) => [name.toLowerCase(), value]))

const make_signature = async ({
	credentials,
	amz_date,
	canonical_request,
}: {
	credentials: S3Credentials
	amz_date: string
	canonical_request: string
}) => {
	const date_stamp = amz_date.slice(0, 8)
	const scope = `${date_stamp}/${credentials.region}/s3/aws4_request`
	const string_to_sign = [algorithm, amz_date, scope, await sha256_hex(canonical_request)].join(`\n`)

	const date_key = await hmac(new Uint8Array(text_encoder.encode(`AWS4${credentials.secret_access_key}`)), date_stamp)
	const region_key = await hmac(date_key, credentials.region)
	const service_key = await hmac(region_key, `s3`)
	const signing_key = await hmac(service_key, `aws4_request`)

	return {
		credential: `${credentials.access_key_id}/${scope}`,
		signature: to_hex(await hmac(signing_key, string_to_sign)),
	}
}

export const sign_request = async ({
	credentials,
	method,
	url,
	headers = {},
	payload_hash,
	date = new Date(),
}: {
	credentials: S3Credentials
	method: string
	url: URL
	headers?: Record<string, string>
	payload_hash: string
	date?: Date
}): Promise<Record<string, string>> => {
	const amz_date = format_amz_date(date)
	const headers_to_sign = {
		...lowercase_header_names(headers),
		host: url.host,
		'x-amz-date': amz_date,
		'x-amz-content-sha256': payload_hash,
	}
	const { canonical, signed_headers } = canonical_headers(headers_to_sign)

	const canonical_request = [
		method,
		canonical_uri(url.pathname),
		canonical_query(parse_query(url.search)),
		canonical,
		signed_headers,
		payload_hash,
	].join(`\n`)

	const { credential, signature } = await make_signature({ credentials, amz_date, canonical_request })

	const { host: _host, ...headers_to_send } = headers_to_sign
	return {
		...headers_to_send,
		authorization: `${algorithm} Credential=${credential}, SignedHeaders=${signed_headers}, Signature=${signature}`,
	}
}

export const presign_url = async ({
	credentials,
	method,
	url,
	expires_in_seconds,
	date = new Date(),
}: {
	credentials: S3Credentials
	method: string
	url: URL
	expires_in_seconds: number
	date?: Date
}): Promise<string> => {
	assert(
		Number.isInteger(expires_in_seconds) && expires_in_seconds >= 1 && expires_in_seconds <= max_presign_expires_in_seconds,
		`Presigned URL expiration is a whole number of seconds from 1 to ${max_presign_expires_in_seconds}`,
	)

	const amz_date = format_amz_date(date)
	const date_stamp = amz_date.slice(0, 8)
	const query = canonical_query([
		...parse_query(url.search),
		[`X-Amz-Algorithm`, algorithm],
		[`X-Amz-Credential`, `${credentials.access_key_id}/${date_stamp}/${credentials.region}/s3/aws4_request`],
		[`X-Amz-Date`, amz_date],
		[`X-Amz-Expires`, String(expires_in_seconds)],
		[`X-Amz-SignedHeaders`, `host`],
	])
	const path = canonical_uri(url.pathname)

	const canonical_request = [
		method,
		path,
		query,
		`host:${url.host}\n`,
		`host`,
		unsigned_payload,
	].join(`\n`)

	const { signature } = await make_signature({ credentials, amz_date, canonical_request })

	return `${url.origin}${path}?${query}&X-Amz-Signature=${signature}`
}
