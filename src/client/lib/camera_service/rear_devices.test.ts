import { test } from 'node:test'
import * as assert from 'node:assert'
import { rear_device_candidates } from './rear_devices.ts'

const back = { kind: `videoinput`, deviceId: `back`, label: `Back Camera` }
const front = { kind: `videoinput`, deviceId: `front`, label: `Front Camera`, getCapabilities: () => ({ facingMode: [`user`] }) }
const wide = { kind: `videoinput`, deviceId: `wide`, label: `Back Ultra Wide Camera`, getCapabilities: () => ({ facingMode: [`environment`] }) }
const microphone = { kind: `audioinput`, deviceId: `mic`, label: `Microphone` }

test('only video inputs are kept', () => {
	assert.deepStrictEqual(rear_device_candidates([back, microphone], { deviceId: `back`, facingMode: `environment` }), [{ device_id: `back`, label: `Back Camera` }], 'the microphone is dropped')
})

test('the current device is dropped when its track faces the user', () => {
	assert.deepStrictEqual(rear_device_candidates([back, wide], { deviceId: `back`, facingMode: `user` }), [{ device_id: `wide`, label: `Back Ultra Wide Camera` }], 'the current front-facing device is dropped')
})

test('other devices are dropped when their capabilities say user', () => {
	assert.deepStrictEqual(rear_device_candidates([back, front, wide], { deviceId: `back`, facingMode: `environment` }), [
		{ device_id: `back`, label: `Back Camera` },
		{ device_id: `wide`, label: `Back Ultra Wide Camera` },
	], 'the front camera is dropped and the rear devices keep their order')
})

test('the current device falls back to its capabilities when the track omits its facing mode', () => {
	assert.deepStrictEqual(rear_device_candidates([front, wide], { deviceId: `front` }), [
		{ device_id: `wide`, label: `Back Ultra Wide Camera` },
	], 'the current front-facing device is dropped based on its capabilities')
})

test('devices capable of environment mode are kept when they are also capable of user mode', () => {
	const movable = { kind: `videoinput`, deviceId: `movable`, label: `Movable Camera`, getCapabilities: () => ({ facingMode: [`user`, `environment`] }) }
	assert.deepStrictEqual(rear_device_candidates([movable], { deviceId: `other` }), [
		{ device_id: `movable`, label: `Movable Camera` },
	], 'an environment-capable device is kept')
})

test('empty device ids do not identify the current device', () => {
	const unknown = { kind: `videoinput`, deviceId: ``, label: `` }
	assert.deepStrictEqual(rear_device_candidates([unknown], { deviceId: ``, facingMode: `user` }), [
		{ device_id: ``, label: `` },
	], 'a device with an empty id is kept when its facing mode is unknown')
})

test('devices with no capabilities are kept', () => {
	const unknown = { kind: `videoinput`, deviceId: `unknown`, label: `` }
	assert.deepStrictEqual(rear_device_candidates([back, unknown], { deviceId: `back` }), [
		{ device_id: `back`, label: `Back Camera` },
		{ device_id: `unknown`, label: `` },
	], 'a device without getCapabilities is kept')
})

test('devices with empty facing modes are kept', () => {
	const webcam = { kind: `videoinput`, deviceId: `webcam`, label: `Webcam`, getCapabilities: () => ({ facingMode: [] }) }
	assert.deepStrictEqual(rear_device_candidates([webcam], { deviceId: `other` }), [{ device_id: `webcam`, label: `Webcam` }], 'a device with no facing mode is kept')
})
