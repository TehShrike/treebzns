export type CaptureMethod = `take_photo` | `video_frame`

export type StringStorage = Pick<Storage, `getItem` | `setItem`>

const storage_key = `photo_capture_method`

const methods = new Set<string>([`take_photo`, `video_frame`])

const read_map = (storage: StringStorage): Record<string, string> =>
	JSON.parse(storage.getItem(storage_key) ?? `{}`)

export const camera_key = ({ label, device_id, user_agent }: { label: string, device_id: string | undefined, user_agent: string }) =>
	`${label || device_id || `unknown`}|${user_agent}`

export const read_cached_method = (storage: StringStorage, key: string): CaptureMethod | null => {
	const value = read_map(storage)[key]
	return value !== undefined && methods.has(value) ? value as CaptureMethod : null
}

export const write_cached_method = (storage: StringStorage, key: string, method: CaptureMethod) =>
	storage.setItem(storage_key, JSON.stringify({ ...read_map(storage), [key]: method }))
