import { test } from 'node:test'
import assert from 'node:assert/strict'
import etag_if_none_match_header_includes from './etag_if_none_match_header_includes.ts'

test(`etag_if_none_match_header_includes matches the same entity tag`, () => {
	assert.equal(etag_if_none_match_header_includes(`"abc"`, `"abc"`), true)
	assert.equal(etag_if_none_match_header_includes(`"abc"`, `"def"`), false)
})

test(`etag_if_none_match_header_includes finds the tag in a list and ignores a weak prefix`, () => {
	assert.equal(etag_if_none_match_header_includes(`"abc", "def"`, `"def"`), true)
	assert.equal(etag_if_none_match_header_includes(`W/"abc"`, `"abc"`), true)
	assert.equal(etag_if_none_match_header_includes(`*`, `"abc"`), true)
})

test(`etag_if_none_match_header_includes never matches without a header or without a stored tag`, () => {
	assert.equal(etag_if_none_match_header_includes(null, `"abc"`), false)
	assert.equal(etag_if_none_match_header_includes(`""`, ``), false)
})
