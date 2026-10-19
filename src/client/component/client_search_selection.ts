import type { CachedClient, CachedClientContact } from '#lib/client_cache.svelte.ts'

export type SearchSelection = {
	client: CachedClient['client']
	contact: CachedClientContact | null
}
