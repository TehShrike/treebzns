// Reusable ArboStar client fetcher — a thin, typed wrapper over the generic DataTables
// fetcher (./fetch_datatable.ts) pinned to the `/clients` module. Rows are returned raw;
// the known fields are typed in #arbostar_export/clients.d.ts.

import { fetch_all_rows, type FetchDataTableOptions } from './fetch_datatable.ts'
import type { ArbostarClient } from '#arbostar_export/clients.d.ts'

// Everything except the module path / order column is shared with the generic fetcher.
export type FetchClientsOptions = Omit<FetchDataTableOptions, 'path' | 'order' | 'extra_params'>

export function fetch_all_clients(
	options: FetchClientsOptions = {},
): Promise<ArbostarClient[]> {
	return fetch_all_rows<ArbostarClient>({
		...options,
		path: '/clients',
		order: { column_index: 0, column_name: 'client_id', dir: 'desc' },
	})
}
