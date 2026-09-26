import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { empty_payload_hash, presign_url, sha256_hex, sign_request, uri_encode, type S3Credentials } from './sign.ts'

// Examples from https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
// and https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
const credentials: S3Credentials = {
	region: `us-east-1`,
	access_key_id: `AKIAIOSFODNN7EXAMPLE`,
	secret_access_key: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`,
}
const date = new Date(`2013-05-24T00:00:00Z`)

const signature_of = (authorization: string | undefined) => authorization?.split(`Signature=`)[1]

test(`sha256_hex hashes the empty string to the empty payload hash`, async () => {
	assert.equal(await sha256_hex(``), empty_payload_hash)
})

test(`uri_encode encodes the characters that encodeURIComponent leaves alone`, () => {
	assert.equal(uri_encode(`a!b'c(d)e*f~g_h-i.j k/l$`), `a%21b%27c%28d%29e%2Af~g_h-i.j%20k%2Fl%24`)
})

test(`sign_request signs a GET with a Range header`, async () => {
	const headers = await sign_request({
		credentials,
		method: `GET`,
		url: new URL(`https://examplebucket.s3.amazonaws.com/test.txt`),
		headers: { Range: `bytes=0-9` },
		payload_hash: empty_payload_hash,
		date,
	})

	assert.deepEqual(headers, {
		range: `bytes=0-9`,
		'x-amz-date': `20130524T000000Z`,
		'x-amz-content-sha256': empty_payload_hash,
		authorization: `AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41`,
	})
})

test(`sign_request signs a PUT with a body hash and an unencoded character in the path`, async () => {
	const headers = await sign_request({
		credentials,
		method: `PUT`,
		url: new URL(`https://examplebucket.s3.amazonaws.com/test$file.text`),
		headers: {
			Date: `Fri, 24 May 2013 00:00:00 GMT`,
			'x-amz-storage-class': `REDUCED_REDUNDANCY`,
		},
		payload_hash: await sha256_hex(`Welcome to Amazon S3.`),
		date,
	})

	assert.equal(signature_of(headers.authorization), `98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd`)
})

test(`sign_request signs a query parameter that has no value`, async () => {
	const headers = await sign_request({
		credentials,
		method: `GET`,
		url: new URL(`https://examplebucket.s3.amazonaws.com/?lifecycle`),
		payload_hash: empty_payload_hash,
		date,
	})

	assert.equal(signature_of(headers.authorization), `fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543`)
})

test(`sign_request sorts query parameters`, async () => {
	const headers = await sign_request({
		credentials,
		method: `GET`,
		url: new URL(`https://examplebucket.s3.amazonaws.com/?prefix=J&max-keys=2`),
		payload_hash: empty_payload_hash,
		date,
	})

	assert.equal(signature_of(headers.authorization), `34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7`)
})

test(`presign_url makes a presigned GET URL`, async () => {
	const url = await presign_url({
		credentials,
		method: `GET`,
		url: new URL(`https://examplebucket.s3.amazonaws.com/test.txt`),
		expires_in_seconds: 86400,
		date,
	})

	assert.equal(url, `https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404`)
})

test(`presign_url rejects an expiration longer than seven days`, async () => {
	await assert.rejects(presign_url({
		credentials,
		method: `GET`,
		url: new URL(`https://examplebucket.s3.amazonaws.com/test.txt`),
		expires_in_seconds: 7 * 24 * 60 * 60 + 1,
		date,
	}))
})
