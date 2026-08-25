// Loads ArboStar credentials + base URL from .arbostar_session.json (gitignored — it holds
// the account domain and live cookies, which must never be committed). Copy
// .arbostar_session.example.json to .arbostar_session.json and fill it in.
//
// To refresh: open the app logged-in, DevTools > Network > any datatable request (e.g. to
// /clients) > Copy as cURL, then lift the base URL, the cookie, and the x-* header values.
// Session cookies rotate every couple of days; a stale session shows up as the exports
// throwing "request failed: 302" (a redirect to the login page).

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type BrowserCookie = { name: string; value: string; domain: string; path: string }

type SessionFile = {
	base_url: string
	headers: Record<string, string>
	cookies?: BrowserCookie[]
	// Origin of the tree-inventory markers microservice, e.g.
	// https://map-markers-ohio-master.arbostar.com. It is region-specific, so it is not
	// derivable from base_url. In the app it is Common.helpers.config_item('map_markers_url').
	map_markers_url?: string
}

const SESSION_PATH = join(dirname(fileURLToPath(import.meta.url)), '.arbostar_session.json')

function load(): SessionFile {
	let raw: string
	try {
		raw = readFileSync(SESSION_PATH, 'utf8')
	} catch {
		throw new Error(
			`Missing scripts/arbostar/.arbostar_session.json — copy .arbostar_session.example.json to it and fill in your base_url + fresh cookies.`,
		)
	}
	return JSON.parse(raw) as SessionFile
}

const session = load()

/** Origin for every request, e.g. https://your-account.arbostar.com */
export const BASE_URL: string = session.base_url
/** Auth headers (cookie + x-csrf-token + x-device-id + x-fingerprint) for fetch-based exports. */
export const AUTH_HEADERS: Record<string, string> = session.headers
/** Cookies for the puppeteer discovery scripts (they set browser cookies, not request headers). */
export const BROWSER_COOKIES: BrowserCookie[] = session.cookies ?? []
/** Account subdomain, e.g. 'coolarborist' — the first host label of BASE_URL. */
export const SUBDOMAIN: string = new URL(BASE_URL).hostname.split('.')[0]!
/** Origin of the tree-inventory markers microservice (unauthenticated GeoJSON). */
export const MAP_MARKERS_URL: string =
	session.map_markers_url ?? 'https://map-markers-ohio-master.arbostar.com'
