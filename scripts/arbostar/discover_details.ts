// One-off discovery: open a single detail/edit view for a client, estimate, invoice, and
// work order, and record every XHR plus the shape of any nested arrays in the responses.
// This is how we find the line-item and client-address endpoints (the list endpoints don't
// include them). Base URL + cookies come from .arbostar_session.json (gitignored).
//
//   node scripts/arbostar/discover_details.ts

import { launch, type HTTPResponse } from 'puppeteer-core'
import { BASE_URL, BROWSER_COOKIES } from './session.ts'

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = BASE_URL
const COOKIES = BROWSER_COOKIES

// Detail/edit URLs to probe, plus the list page to fall back to for harvesting links.
const TARGETS = [
	{ name: 'client', list: '/clients', detail: ['/clients/1441', '/clients/view/1441', '/clients/edit/1441'] },
	{ name: 'estimate', list: '/estimates', detail: ['/estimates/1702', '/estimates/edit/1702', '/estimates/view/1702'] },
	{ name: 'invoice', list: '/invoices', detail: ['/invoices/859', '/invoices/edit/859', '/invoices/view/859'] },
	{ name: 'workorder', list: '/workorders', detail: ['/workorders/889', '/workorders/edit/889', '/workorders/view/889'] },
]

function describe_value(value: unknown): string {
	if (Array.isArray(value)) {
		const first = value.find(v => v && typeof v === 'object')
		const keys = first ? Object.keys(first as object).slice(0, 40).join(', ') : ''
		return `array(${value.length})${keys ? ` of { ${keys} }` : ''}`
	}
	if (value && typeof value === 'object') return `object { ${Object.keys(value as object).slice(0, 30).join(', ')} }`
	return typeof value
}

const seen = new Set<string>()

async function record(response: HTTPResponse, label: string): Promise<void> {
	const request = response.request()
	const type = request.resourceType()
	if (type !== 'xhr' && type !== 'fetch') return
	const url = new URL(request.url())
	if (url.origin !== ORIGIN) return
	const ct = (response.headers()['content-type'] ?? '').split(';')[0]!.trim()
	if (!ct.includes('json')) return
	const key = `${label} ${request.method()} ${url.pathname}`
	if (seen.has(key)) return
	seen.add(key)

	let detail = ''
	try {
		const body = await response.json()
		if (body && typeof body === 'object') {
			// Surface arrays (likely line items / addresses) anywhere one or two levels deep.
			const lines: string[] = []
			for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
				lines.push(`      ${k}: ${describe_value(v)}`)
				if (v && typeof v === 'object' && !Array.isArray(v)) {
					for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
						if (Array.isArray(v2)) lines.push(`        ${k}.${k2}: ${describe_value(v2)}`)
					}
				}
			}
			detail = '\n' + lines.join('\n')
		}
	} catch {
		// ignore
	}
	console.log(`  ${request.method()} ${url.pathname}${url.search ? url.search.slice(0, 60) : ''}${detail}`)
}

const browser = await launch({
	executablePath: CHROME_PATH,
	headless: true,
	args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

try {
	await browser.setCookie(...COOKIES)
	for (const target of TARGETS) {
		console.log(`\n======== ${target.name} ========`)
		for (const path of target.detail) {
			const page = await browser.newPage()
			page.on('response', r => void record(r, target.name).catch(() => {}))
			try {
				const response = await page.goto(`${ORIGIN}${path}`, { waitUntil: 'networkidle2', timeout: 45_000 })
				await new Promise(r => setTimeout(r, 2_000))
				const finalUrl = page.url()
				const status = response?.status()
				console.log(`[${path}] -> ${status} final=${finalUrl.replace(ORIGIN, '')}`)
				if (status && status < 400 && finalUrl.includes(path.split('/')[1]!)) {
					await page.close()
					break // got a working detail view; stop trying alternates
				}
			} catch (e) {
				console.log(`[${path}] failed: ${(e as Error).message}`)
			}
			await page.close()
		}
	}
} finally {
	await browser.close()
}
