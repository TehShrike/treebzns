import * as assert from 'node:assert/strict'
import { create_spaces_client } from './spaces.ts'

const env_value = (name: string): string => {
	const value = process.env[name]
	assert.ok(value, `${name} is set`)
	return value
}

const s3 = create_spaces_client({
	SPACES_REGION: env_value(`SPACES_REGION`),
	SPACES_BUCKET: env_value(`SPACES_BUCKET`),
	SPACES_ACCESS_KEY_ID: env_value(`SPACES_ACCESS_KEY_ID`),
	SPACES_SECRET_ACCESS_KEY: env_value(`SPACES_SECRET_ACCESS_KEY`),
})

const key = `smoke_test/${crypto.randomUUID()} (spaces & signing).bin`
const bytes = crypto.getRandomValues(new Uint8Array(64 * 1024))
const content_type = `application/octet-stream`

const step = async (name: string, fn: () => Promise<void>) => {
	await fn()
	console.log(`✔ ${name}`)
}

try {
	await step(`put_object uploads a Blob`, async () => {
		await s3.put_object({ key, body: new Blob([bytes]), content_type })
	})

	await step(`head_object returns the length and content type`, async () => {
		const head = await s3.head_object({ key })
		assert.ok(head, `the object exists`)
		assert.equal(head.content_length, bytes.length)
		assert.equal(head.content_type, content_type)
	})

	await step(`get_object returns the same bytes`, async () => {
		const response = await s3.get_object({ key })
		assert.ok(response, `the object exists`)
		assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
	})

	await step(`a presigned URL returns the same bytes`, async () => {
		const response = await fetch(await s3.presign_url({ key, expires_in_seconds: 60 }))
		assert.equal(response.status, 200)
		assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
	})

	await step(`an unsigned request is forbidden`, async () => {
		const presigned = new URL(await s3.presign_url({ key, expires_in_seconds: 60 }))
		const response = await fetch(`${presigned.origin}${presigned.pathname}`)
		await response.text()
		assert.equal(response.status, 403)
	})

	await step(`get_object and head_object return null for a missing key`, async () => {
		assert.equal(await s3.get_object({ key: `${key}.missing` }), null)
		assert.equal(await s3.head_object({ key: `${key}.missing` }), null)
	})

	await step(`delete_object removes the object`, async () => {
		await s3.delete_object({ key })
		assert.equal(await s3.head_object({ key }), null)
	})
} catch (error) {
	await s3.delete_object({ key }).catch(cleanup_error => console.error(`Could not delete ${key}`, cleanup_error))
	throw error
}
