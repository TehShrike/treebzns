import { filter, flat_map } from '#shared/array.ts'

export const tokenize_string = (str: string) => filter(str.toLowerCase().split(/\s+/g), Boolean)

export const tokenize_strings = (strs: readonly string[]) => Array.from(new Set(flat_map(strs, tokenize_string)))
