import { map, some } from '#shared/array.ts'

export const if_none_match_includes = (header: string | null, etag: string): boolean => {
	if (header === null || etag === ``) return false

	return some(map(header.split(`,`), value => value.trim()), value => value === `*` || value === etag || value === `W/${etag}`)
}
