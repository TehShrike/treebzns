import is_localhost from '#lib/is_localhost.ts'

const COOKIE_NAME = 'session'
const ABOUT_ONE_DAY_MS = 24 * 60 * 60 * 1000

export default ({ session_identifier, days, host }: { session_identifier: string, days: number, host: string }): Record<string, string> => {
	const expires = new Date(Date.now() + (ABOUT_ONE_DAY_MS * days)).toUTCString()
	const secure = is_localhost(host) ? '' : ' Secure;'
	return {
		'Set-Cookie': `${COOKIE_NAME}=${session_identifier}; Expires=${expires}; HttpOnly;${secure} SameSite=Strict; Path=/`,
	}
}
