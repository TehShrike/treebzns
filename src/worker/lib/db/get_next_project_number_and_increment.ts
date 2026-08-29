import assert from '#shared/assert.ts'
import { fns } from '#shared/sql_request/mysql_function.ts'
import type { Context } from '#worker/lib/context.ts'

const get_next_project_number_and_increment = async ({
	company_id,
	write_helper,
}: {
	company_id: bigint
	write_helper: Context['write_helper']
}): Promise<bigint> => {
	const { insert_id: number } = await write_helper.update('project_number', 'company_id', company_id, {
		next_number: fns.last_insert_id_increment('next_number', 1n),
	})
	assert(number > 0n)

	return number
}

export default get_next_project_number_and_increment
