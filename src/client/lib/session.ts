import f3tch from '#shared/f3tch.ts'
import assert from '#shared/assert.ts'
import type { SessionResponse, LoggedInSession } from '#shared/type/session.ts'

export default () => {
	let session: Promise<SessionResponse> | null = null

	const get = (): Promise<SessionResponse> => {
		session ??= (f3tch(`/api/session`) as Promise<SessionResponse>).catch(error => {
			session = null
			throw error
		})
		return session
	}

	const get_logged_in = async (): Promise<LoggedInSession> => {
		const session_response = await get()
		assert(session_response.logged_in, `states under app resolve only for a logged in employee`)
		return session_response
	}

	const clear = () => {
		session = null
	}

	return {
		get,
		get_logged_in,
		clear,
	}
}
