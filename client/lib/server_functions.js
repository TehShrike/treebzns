import f3tch from '#shared/f3tch.ts'

const call_server_function = (function_name) => async (arg) => f3tch(`/api/fn/${function_name}`, {
	method: 'POST',
	body: arg,
})

export default {
	create_company: call_server_function('create_company'),
	ping: call_server_function('ping'),
}
