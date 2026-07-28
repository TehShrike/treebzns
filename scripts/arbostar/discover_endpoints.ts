// Endpoint discovery: drives a real (logged-in) Chrome around the ArboStar webapp and
// records every XHR/fetch it makes, so we can see the actual API routes + param shapes
// behind the projects / invoices / estimates / leads screens.
//
//   node scripts/arbostar/discover_endpoints.ts
//
// Uses puppeteer-core against the system Chrome (no Chromium download). Paste fresh
// session cookies into COOKIES below. Writes a deduped report to arbostar_endpoints.json
// and prints a summary table. No response bodies / row data are stored — only route
// metadata (method, path, status, content-type, top-level JSON keys, record counts).

import { launch, type Browser, type HTTPResponse } from 'puppeteer-core'
import { some } from '#shared/array.ts'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE_URL, BROWSER_COOKIES } from './session.ts'

// macOS default; override if Chrome lives elsewhere.
const CHROME_PATH =
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// Base URL + cookies come from .arbostar_session.json (gitignored).
const ORIGIN = BASE_URL
const COOKIES = BROWSER_COOKIES

// Pages to visit. We start at the dashboard, harvest same-origin nav links, then visit any
// whose href/text hints at a module we care about (plus these explicit seeds as a fallback).
const SEED_PATHS = ['/', '/clients', '/leads', '/estimates', '/invoices']
const TARGET_KEYWORDS = [
	'project', 'invoice', 'estimate', 'lead', 'client',
	'job', 'work', 'order', 'schedule', 'payment', 'crew',
]

// Written next to this script — it's a committed reference artifact, not export output.
const REPORT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'arbostar_endpoints.json')

type Captured = {
	method: string
	path: string
	/** path + querystring (no origin), e.g. "/workorders?draw=1&...". An example request. */
	path_and_query: string
	status: number
	content_type: string
	resource_type: string
	is_json: boolean
	json_keys: string[]
	records_total: number | null
	seen_on: Set<string>
}

const captured = new Map<string, Captured>()

function key_for(method: string, path: string): string {
	return `${method} ${path}`
}

async function record_response(response: HTTPResponse, seen_on: string): Promise<void> {
	const request = response.request()
	const resource_type = request.resourceType()
	if (resource_type !== 'xhr' && resource_type !== 'fetch') return

	const url = new URL(request.url())
	if (url.origin !== ORIGIN) return

	const method = request.method()
	const path = url.pathname
	const content_type = (response.headers()['content-type'] ?? '').split(';')[0]!.trim()
	const is_json = content_type.includes('json')

	let json_keys: string[] = []
	let records_total: number | null = null
	if (is_json) {
		try {
			const body = (await response.json()) as Record<string, unknown>
			if (body && typeof body === 'object' && !Array.isArray(body)) {
				json_keys = Object.keys(body)
				if (typeof body['recordsTotal'] === 'number') records_total = body['recordsTotal']
			} else if (Array.isArray(body)) {
				json_keys = ['<array>']
				records_total = body.length
			}
		} catch {
			// streamed / already-consumed / non-JSON-despite-header — skip the body peek
		}
	}

	const k = key_for(method, path)
	const existing = captured.get(k)
	if (existing) {
		existing.seen_on.add(seen_on)
		if (existing.records_total === null) existing.records_total = records_total
		if (existing.json_keys.length === 0) existing.json_keys = json_keys
		return
	}
	captured.set(k, {
		method,
		path,
		path_and_query: url.pathname + url.search,
		status: response.status(),
		content_type,
		resource_type,
		is_json,
		json_keys,
		records_total,
		seen_on: new Set([seen_on]),
	})
}

async function visit(browser: Browser, path: string): Promise<string[]> {
	const page = await browser.newPage()
	const links: string[] = []
	page.on('response', response => {
		void record_response(response, path).catch(() => {})
	})
	try {
		await page.goto(`${ORIGIN}${path}`, { waitUntil: 'networkidle2', timeout: 45_000 })
		// give lazy datatables / deferred XHR a beat to fire
		await new Promise(resolve => setTimeout(resolve, 2_500))
		const hrefs = await page.$$eval('a[href]', anchors =>
			anchors.map(a => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
		)
		for (const href of hrefs) {
			if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue
			try {
				const resolved = new URL(href, ORIGIN)
				if (resolved.origin === ORIGIN) links.push(resolved.pathname)
			} catch {
				// ignore unparseable hrefs
			}
		}
	} catch (error) {
		console.log(`  ! ${path} failed: ${(error as Error).message}`)
	} finally {
		await page.close()
	}
	return links
}

const browser = await launch({
	executablePath: CHROME_PATH,
	headless: true,
	args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

try {
	await browser.setCookie(...COOKIES)

	const visited = new Set<string>()

	// Round 1: seeds + harvest links.
	const discovered_links = new Set<string>()
	for (const path of SEED_PATHS) {
		if (visited.has(path)) continue
		visited.add(path)
		console.log(`visiting ${path}`)
		const links = await visit(browser, path)
		links.forEach(l => discovered_links.add(l))
	}

	// Round 2: visit harvested links that match a target module keyword.
	const targets = [...discovered_links]
		.filter(path => !visited.has(path))
		.filter(path => some(TARGET_KEYWORDS, keyword => path.toLowerCase().includes(keyword)))
		.filter(path => !/\/\d+(\/|$)/.test(path)) // skip per-record detail pages
		.sort()

	for (const path of targets) {
		if (visited.has(path)) continue
		visited.add(path)
		console.log(`visiting ${path} (discovered)`)
		await visit(browser, path)
	}

	const report = [...captured.values()]
		.map(c => ({ ...c, seen_on: [...c.seen_on].sort() }))
		.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))

	writeFileSync(REPORT_PATH, JSON.stringify(report, null, '\t') + '\n')

	console.log(`\n=== ${report.length} distinct XHR/fetch endpoints ===`)
	for (const c of report) {
		const total = c.records_total === null ? '' : ` records=${c.records_total}`
		console.log(
			`${String(c.status).padEnd(3)} ${c.method.padEnd(4)} ${c.path.padEnd(40)} ` +
				`${c.content_type.padEnd(20)}${total}  [${c.seen_on.join(', ')}]`,
		)
		if (c.json_keys.length) console.log(`        keys: ${c.json_keys.join(', ')}`)
	}
	console.log(`\nFull report -> ${REPORT_PATH}`)
} finally {
	await browser.close()
}
