import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import error_message from './error_message.ts'

test('a rejected server response shows the message from its body', () => {
	const error = { res: {}, body: { message: `Unauthorized` }, text: `{"message":"Unauthorized"}` }

	assert.equal(error_message(error), `Unauthorized`, 'the body message is the message')
})

test('an Error shows its own message', () => {
	assert.equal(error_message(new Error(`The request timed out`)), `The request timed out`, 'the Error message is the message')
})

test('the body message wins over the message of the object that carries it', () => {
	const error = Object.assign(new Error(`Request failed`), { body: { message: `Price is required` } })

	assert.equal(error_message(error), `Price is required`, 'the body message is the message')
})

test('a string is its own message', () => {
	assert.equal(error_message(`Camera is not available`), `Camera is not available`, 'the string is the message')
})

test('a value with no message shows the fallback message', () => {
	assert.equal(error_message(null), `Something went wrong`, 'null has the fallback message')
	assert.equal(error_message(undefined), `Something went wrong`, 'undefined has the fallback message')
	assert.equal(error_message(``), `Something went wrong`, 'an empty string has the fallback message')
	assert.equal(error_message({ res: {}, body: null, text: `` }), `Something went wrong`, 'a response with no body has the fallback message')
	assert.equal(error_message(new Error(``)), `Something went wrong`, 'an Error with an empty message has the fallback message')
})
