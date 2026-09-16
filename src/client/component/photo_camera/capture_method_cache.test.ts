import { test } from 'node:test'
import assert from 'node:assert/strict'
import { camera_key, read_cached_method, write_cached_method, type StringStorage } from './capture_method_cache.ts'

const fake_storage = (): StringStorage & { data: Map<string, string> } => {
	const data = new Map<string, string>()
	return {
		data,
		getItem: key => data.get(key) ?? null,
		setItem: (key, value) => {
			data.set(key, value)
		},
	}
}

test(`camera_key: prefers the label, then the device id, then unknown`, () => {
	assert.equal(camera_key({ label: `Back Camera`, device_id: `abc`, user_agent: `UA` }), `Back Camera|UA`)
	assert.equal(camera_key({ label: ``, device_id: `abc`, user_agent: `UA` }), `abc|UA`)
	assert.equal(camera_key({ label: ``, device_id: undefined, user_agent: `UA` }), `unknown|UA`)
})

test(`capture method cache: a written method reads back and other keys stay separate`, () => {
	const storage = fake_storage()
	assert.equal(read_cached_method(storage, `a`), null)
	write_cached_method(storage, `a`, `video_frame`)
	write_cached_method(storage, `b`, `take_photo`)
	assert.equal(read_cached_method(storage, `a`), `video_frame`)
	assert.equal(read_cached_method(storage, `b`), `take_photo`)
})

test(`capture method cache: an unknown stored method reads as nothing cached`, () => {
	const storage = fake_storage()
	storage.data.set(`photo_capture_method`, JSON.stringify({ a: `something_else` }))
	assert.equal(read_cached_method(storage, `a`), null)
})
