import server_functions from './lib/server_functions.js'

const context = {
	server: server_functions
} as const

export type Context = typeof context

export default context
