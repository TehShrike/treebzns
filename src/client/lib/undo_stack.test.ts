import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import undo_stack from './undo_stack.ts'

test('an empty stack has nothing to undo or redo', () => {
	const stack = undo_stack.empty<string>()

	assert.deepEqual(stack, { done: [], undone: [] }, 'both lists start empty')
	assert.equal(undo_stack.can_undo(stack), false, 'there is nothing to undo')
	assert.equal(undo_stack.can_redo(stack), false, 'there is nothing to redo')
})

test('push appends to the done list', () => {
	const stack = undo_stack.push(undo_stack.push(undo_stack.empty<string>(), `a`), `b`)

	assert.deepEqual(stack.done, [`a`, `b`], 'entries stay in the order they were pushed')
	assert.equal(undo_stack.can_undo(stack), true, 'a pushed entry can be undone')
})

test('undo moves the most recent entry to the undone list', () => {
	const pushed = undo_stack.push(undo_stack.push(undo_stack.empty<string>(), `a`), `b`)
	const once = undo_stack.undo(pushed)

	assert.deepEqual(once, { done: [`a`], undone: [`b`] }, 'the last entry is undone first')
	assert.equal(undo_stack.can_redo(once), true, 'an undone entry can be redone')

	const twice = undo_stack.undo(once)
	assert.deepEqual(twice, { done: [], undone: [`b`, `a`] }, 'the most recently undone entry is last')
	assert.equal(undo_stack.can_undo(twice), false, 'nothing is left to undo')
})

test('redo restores the most recently undone entry', () => {
	const pushed = undo_stack.push(undo_stack.push(undo_stack.empty<string>(), `a`), `b`)
	const undone = undo_stack.undo(undo_stack.undo(pushed))

	const once = undo_stack.redo(undone)
	assert.deepEqual(once, { done: [`a`], undone: [`b`] }, 'the first entry comes back first')

	const twice = undo_stack.redo(once)
	assert.deepEqual(twice, pushed, 'redoing everything restores the original stack')
	assert.equal(undo_stack.can_redo(twice), false, 'nothing is left to redo')
})

test('push after undo discards the undone entries', () => {
	const stack = undo_stack.push(undo_stack.undo(undo_stack.push(undo_stack.empty<string>(), `a`)), `b`)

	assert.deepEqual(stack, { done: [`b`], undone: [] }, 'a new entry starts a new future')
	assert.equal(undo_stack.can_redo(stack), false, 'the discarded entry cannot be redone')
})

test('undo and redo throw when there is nothing to undo or redo', () => {
	assert.throws(() => undo_stack.undo(undo_stack.empty()), /entry to undo/, 'undo requires a done entry')
	assert.throws(() => undo_stack.redo(undo_stack.empty()), /entry to redo/, 'redo requires an undone entry')
})

test('operations return new stacks and leave the input unchanged', () => {
	const original = undo_stack.push(undo_stack.empty<string>(), `a`)
	const original_copy = structuredClone(original)

	undo_stack.push(original, `b`)
	undo_stack.undo(original)
	undo_stack.redo(undo_stack.undo(original))

	assert.deepEqual(original, original_copy, 'the input stack keeps its entries')
})
