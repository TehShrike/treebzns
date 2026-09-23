// Per-record ArboStar paths that have passed the safety protocol in
// src/notes/2026-09-22-safely-read-lost-data.md. fetch_json refuses any other path. A GET
// to an editor page writes (the estimate editor creates a draft estimate and moves the lead
// to Draft), so a path is unverified until probe_endpoint.ts has shown it changes nothing.

import { some } from '#shared/array.ts'

export const VERIFIED_RECORD_PATHS: readonly RegExp[] = [
	/^\/estimates\/profile\/profileData\/\d+$/,
	/^\/leads\/leads\/profileData\/\d+$/,
	/^\/treeInventory\/show\/\d+$/,
	/^\/user\/get\/\d+$/,
]

const FORBIDDEN_SEGMENT = /\/(edit|create|add|new|save|update|delete|change)(?=\/|$|\?)/i

const without_query = (path: string): string => path.split('?')[0]!

export const is_forbidden_path = (path: string): boolean => FORBIDDEN_SEGMENT.test(without_query(path))

export const is_verified_path = (path: string): boolean =>
	!is_forbidden_path(path) && some(VERIFIED_RECORD_PATHS, pattern => pattern.test(without_query(path)))

export const assert_not_forbidden_path = (path: string): void => {
	if (is_forbidden_path(path)) {
		throw new Error(
			`ArboStar path ${path} is an editor or mutation URL and must never be requested. See "Editor pages write on load" in scripts/arbostar/readme.md.`,
		)
	}
}

export const assert_verified_path = (path: string): void => {
	assert_not_forbidden_path(path)
	if (!is_verified_path(path)) {
		throw new Error(
			`ArboStar path ${path} is not a verified read-only per-record endpoint. See "Editor pages write on load" in scripts/arbostar/readme.md. Run \`node scripts/arbostar/probe_endpoint.ts --lead_id <n> --path ${path}\` and add the pattern to scripts/arbostar/verified_endpoints.ts once it passes.`,
		)
	}
}
