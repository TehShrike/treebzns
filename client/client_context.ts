import server_functions from './lib/server_functions.ts'
import client_query_fn from './lib/client_query_fn.ts'


const context = {
	server: server_functions,
	query: client_query_fn,
} as const

export type Context = typeof context

export default context
