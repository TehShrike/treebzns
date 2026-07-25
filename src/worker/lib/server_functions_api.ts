import type { Validator } from '#shared/json_validator.ts'

import type { Context } from './context.ts'

type Endpoint<Arg, Response> = {
	validator: Validator<Arg>,
	fn: (arg: Arg, context: Context) => Promise<Response>,
}

export const sfns = <
	Args extends Record<string, unknown>,
	Fns extends { [K in keyof Args]: (arg: Args[K], context: Context) => Promise<unknown> },
>(
	endpoints: { [K in keyof Args]: { validator: Validator<Args[K]>, fn: Fns[K] } },
) => endpoints

export const sfn = <Arg, Response>(endpoint: Endpoint<Arg, Response>) => endpoint
