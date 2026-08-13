import fnum from '#shared/fnum.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import arbostar_number_to_fnum from '#shared/arbostar/arbostar_number_to_fnum.ts'
import { for_each } from '#shared/array.ts'
import clients from '#arbostar_export/clients.js'

export const zero = fnum('0')

export const money = (value: number | string | null): FinancialNumber =>
	value === null ? zero : arbostar_number_to_fnum(value)

export const sum = <T>(items: readonly T[], get: (item: T) => FinancialNumber): FinancialNumber => {
	let total = zero
	for_each(items, item => {
		total = total.plus(get(item))
	})
	return total
}

export const display = (value: FinancialNumber): string => value.changeDecimalPlaces(2n).toString()

const client_names = new Map<number, string>()
for_each(clients, client => {
	client_names.set(client.client_id, client.client_name)
})

export const client_name = (client_id: number): string =>
	client_names.get(client_id) ?? `<unknown client ${ client_id }>`
