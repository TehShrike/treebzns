import type { Pool } from 'mysql2/promise'
import type { Validator } from '#shared/json_validator.ts'

import type { Context } from './context.ts'

type Endpoint<Arg, Response> = {
	validator: Validator<Arg>,
	fn: (arg: Arg, context: Context) => Promise<Response>,
}

export const sfns = <Endpoints extends Record<string, Endpoint<any, any>>>(endpoints: Endpoints) => endpoints

export const sfn = <Arg, Response>(endpoint: Endpoint<Arg, Response>) => endpoint
