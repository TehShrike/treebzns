import type { Pool } from 'mysql2/promise'
import type { Validator } from './json_validator.ts'


export type Context = {
	user: Pick<DbCompany, 'company_id'>
	mysql: Pool
}

type Endpoint<Arg, Response> = {
	validator: Validator<Arg>,
	fn: (arg: Arg, context: Context) => Promise<Response>,
}

export const sfns = <Endpoints extends Record<string, Endpoint<any, any>>>(endpoints: Endpoints) => endpoints

export const sfn = <Arg, Response>(endpoint: Endpoint<Arg, Response>) => endpoint
