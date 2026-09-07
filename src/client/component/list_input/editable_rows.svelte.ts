import { filter } from '#shared/array.ts'
import type { RowKey } from './row_key.ts'
import { plan_cleanup, make_key_assigner } from './editable_rows_logic.ts'

const editable_rows = <Row extends object>({ initial, make_empty_row, row_is_empty, get_key: get_key_or_null }: {
	initial: readonly Row[]
	make_empty_row: () => Row
	row_is_empty: (row: Row) => boolean
	get_key: (row: Row) => RowKey | null
}) => {
	const get_key = make_key_assigner(get_key_or_null)

	let rows = $state<Row[]>([...initial])
	let focused_row_key = $state<RowKey | null>(null)

	const non_empty_rows = $derived(filter(rows, row => !row_is_empty(row)))

	const remove_empty_rows = () => {
		const { rows_to_keep } = plan_cleanup({ rows, row_is_empty, get_key, focused_row_key })

		if (rows_to_keep.length !== rows.length) {
			rows = rows_to_keep
		}
	}

	$effect(() => {
		const { rows_to_keep, needs_new_empty_row } = plan_cleanup({ rows, row_is_empty, get_key, focused_row_key })

		if (needs_new_empty_row) {
			rows.push(make_empty_row())
			return
		}

		if (rows_to_keep.length !== rows.length) {
			const timeout = setTimeout(remove_empty_rows, 0)
			return () => clearTimeout(timeout)
		}
	})

	const row_is_placeholder = (row: Row) => {
		const last_row = rows[rows.length - 1]
		return last_row !== undefined && get_key(row) === get_key(last_row) && row_is_empty(row)
	}

	return {
		get rows() { return rows },
		get focused_row_key() { return focused_row_key },
		set focused_row_key(key: RowKey | null) { focused_row_key = key },
		get non_empty_rows() { return non_empty_rows },
		get_key,
		remove: (key: RowKey) => {
			rows = filter(rows, row => get_key(row) !== key)
		},
		row_is_placeholder,
	}
}

export type EditableRows<Row extends object> = ReturnType<typeof editable_rows<Row>>

export default editable_rows
