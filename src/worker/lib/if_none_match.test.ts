import { test } from 'node:test'
import assert from 'node:assert/strict'
import { if_none_match_includes } from './if_none_match.ts'

test(`if_none_match_includes matches the same entity tag`, () => {
	assert.equal(if_none_match_includes(`"abc"`, `"abc"`), true)
	assert.equal(if_none_match_includes(`"abc"`, `"def"`), false)
})

test(`if_none_match_includes finds the tag in a list and ignores a weak prefix`, () => {
	assert.equal(if_none_match_includes(`"abc", "def"`, `"def"`), true)
	assert.equal(if_none_match_includes(`W/"abc"`, `"abc"`), true)
	assert.equal(if_none_match_includes(`*`, `"abc"`), true)
})

test(`if_none_match_includes never matches without a header or without a stored tag`, () => {
	assert.equal(if_none_match_includes(null, `"abc"`), false)
	assert.equal(if_none_match_includes(`""`, ``), false)
})
