import f3tch from '#shared/f3tch.ts'

const call_server_function = (function_name: string) => async (arg: unknown) => f3tch(`/api/fn/${function_name}`, {
	method: 'POST',
	body: arg,
})

const server_functions: {
	create_company: (arg: { name: string; }) => Promise<Pick<DbCompany, "name" | "company_id">>
	ping: (arg: { readonly timeout: 1000n | 2000n | 3000n; }) => Promise<{ pong: boolean; user_id: bigint; }>
} = {
	create_company: call_server_function('create_company'),
	ping: call_server_function('ping'),
}

export default server_functions
