const COOKIE_NAME = 'session'
const ABOUT_ONE_DAY_MS = 24 * 60 * 60 * 1000

export default ({ session_identifier, days }: { session_identifier: string, days: number }): Record<string, string> => {
	const expires = new Date(Date.now() + (ABOUT_ONE_DAY_MS * days)).toUTCString()
	return {
		'Set-Cookie': `${COOKIE_NAME}=${session_identifier}; Expires=${expires}; HttpOnly; Secure; SameSite=Strict; Path=/`,
	}
}
