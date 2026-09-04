import { test } from 'node:test'
import assert from 'node:assert/strict'
import all_properties_have_values from './all_properties_have_values.ts'

type Address = { city: string, zip: string }

test('all_properties_have_values: true when every key has a value', () => {
	const object: Partial<Address> = { city: 'Omaha', zip: '68131' }
	assert.equal(all_properties_have_values(['city', 'zip'], object), true)
})

test('all_properties_have_values: false when a key is absent', () => {
	const object: Partial<Address> = { city: 'Omaha' }
	assert.equal(all_properties_have_values(['city', 'zip'], object), false)
})

test('all_properties_have_values: false when a key is explicitly undefined', () => {
	const object: { city?: string | undefined, zip?: string | undefined } = { city: 'Omaha', zip: undefined }
	assert.equal(all_properties_have_values(['city', 'zip'], object), false)
})

test('all_properties_have_values: empty string and null count as values', () => {
	const object: Partial<{ city: string, tax_rate_id: bigint | null }> = { city: '', tax_rate_id: null }
	assert.equal(all_properties_have_values(['city', 'tax_rate_id'], object), true)
})

test('all_properties_have_values: the key list must name every key of the type', () => {
	const object: Partial<Address> = { city: 'Omaha' }
	// @ts-expect-error zip is missing from the key list
	all_properties_have_values(['city'], object)
})
