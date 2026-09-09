import { filter } from '#shared/array.ts'
import type { RowKey } from './row_key.ts'

export const plan_cleanup = <Row>({ rows, row_is_empty, get_key, focused_row_key }: {
	rows: readonly Row[]
	row_is_empty: (row: Row) => boolean
	get_key: (row: Row) => RowKey
	focused_row_key: RowKey | null
}): { rows_to_keep: Row[], needs_new_empty_row: boolean } => {
	const last_row = rows[rows.length - 1]

	const rows_to_keep = filter(rows, row =>
		row === last_row
		|| get_key(row) === focused_row_key
		|| !row_is_empty(row)
	)

	const last_kept_row = rows_to_keep[rows_to_keep.length - 1]
	const needs_new_empty_row = last_kept_row === undefined || !row_is_empty(last_kept_row)

	return { rows_to_keep, needs_new_empty_row }
}
