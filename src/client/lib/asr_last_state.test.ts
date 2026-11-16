import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { create_asr_last_state } from './asr_last_state.ts'

type State = { name: string, parameters: { [key: string]: string } }

const no_state: State = { name: ``, parameters: {} }
const leads: State = { name: `menu.leads`, parameters: {} }
const line_items: State = { name: `estimate.line_items`, parameters: { project_id: `1` } }
const camera = (line_item_id: string): State => ({ name: `estimate.camera`, parameters: { project_id: `1`, line_item_id } })
const edit = (line_item_id: string): State => ({ name: `estimate.edit`, parameters: { project_id: `1`, line_item_id } })
const mark_up_photo: State = { name: `estimate.mark_up_photo`, parameters: { project_id: `1`, line_item_id: `5`, image_id: `9` } }

const create_last_estimate_state = () => {
	const last_state = create_asr_last_state<State>(({ name }) => name.startsWith(`estimate.`))
	return (current_state: State, state_being_transitioned_to: State) => last_state({ current_state, state_being_transitioned_to })
}

test(`the last state is the state that the router leaves, with the parameters it had`, () => {
	const enter = create_last_estimate_state()

	assert.deepEqual(enter(camera(`5`), edit(`5`)), camera(`5`))
})

test(`a state loaded directly has no last state`, () => {
	const enter = create_last_estimate_state()

	assert.equal(enter(no_state, edit(`5`)), null)
})

test(`a state out of scope is not a last state`, () => {
	const enter = create_last_estimate_state()

	assert.equal(enter(leads, edit(`5`)), null)
})

test(`a state keeps its last state when the router goes back to it`, () => {
	const enter = create_last_estimate_state()

	enter(line_items, edit(`5`))
	enter(edit(`5`), mark_up_photo)

	assert.deepEqual(enter(mark_up_photo, edit(`5`)), line_items)
})

test(`a state loaded directly still has no last state when the router goes back to it`, () => {
	const enter = create_last_estimate_state()

	enter(no_state, edit(`5`))
	enter(edit(`5`), mark_up_photo)

	assert.equal(enter(mark_up_photo, edit(`5`)), null)
})

test(`a new visit to a state replaces the last state from the visit before`, () => {
	const enter = create_last_estimate_state()

	enter(line_items, edit(`5`))

	assert.deepEqual(enter(camera(`6`), edit(`6`)), camera(`6`))
	assert.equal(enter(leads, edit(`6`)), null)
})

test(`a move between two records of one state makes the first record the last state`, () => {
	const enter = create_last_estimate_state()

	enter(line_items, camera(`5`))

	assert.deepEqual(enter(camera(`5`), camera(`6`)), camera(`5`))
})

test(`the last state is only known during a transition`, () => {
	const last_state = create_asr_last_state<State>(() => true)

	assert.throws(() => last_state({ current_state: line_items, state_being_transitioned_to: null }))
})
