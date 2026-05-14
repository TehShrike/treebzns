import type { Context } from '../client_context.js'
import assert from '#shared/assert.ts'

type StateParams = {
	[key: string]: string | { toString: () => string }
}

type StringParameters<KEYS extends string> = {
	[key in KEYS]?: string
}

type DefaultParameters<PARAMS> = {
	[key in keyof PARAMS]: PARAMS[key] | (() => PARAMS[key])
}

type ParamValidator<T> = (query_params: { [key: string]: string | string[] }) => T

export type State<
	QUERYSTRING_PARAM_KEYS extends string,
	ALL_PARAMS,
	DATA extends object,
	RESOLVE extends object
> = {
	name: string
	route: string
	default_child?: string
	data?: DATA
	resolve?: (data: Context & DATA, params: ALL_PARAMS) => Promise<RESOLVE>
	querystring_parameters?: QUERYSTRING_PARAM_KEYS[]
	default_parameters?: DefaultParameters<ALL_PARAMS>
	param_validator?: ParamValidator<ALL_PARAMS>
}

export const state_type = <
	QUERYSTRING_PARAM_KEYS extends string,
	ALL_PARAMS = StringParameters<QUERYSTRING_PARAM_KEYS>,
	DATA extends object = {},
	RESOLVE extends object = {}
>(endpoint: State<QUERYSTRING_PARAM_KEYS, ALL_PARAMS, DATA, RESOLVE>) => {
	if (endpoint.querystring_parameters || endpoint.default_parameters) {
		assert(endpoint.param_validator !== undefined)
	}
	return endpoint
}
