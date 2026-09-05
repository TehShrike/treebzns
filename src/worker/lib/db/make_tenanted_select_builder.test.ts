import assert from 'node:assert/strict'
import test from 'node:test'
import type { Connection } from 'mysql2/promise'
import { transaction } from '#shared/mysql/helpers.ts'
import make_mysql_helpers_object from '#shared/mysql/mysql_helpers_object.ts'
import type { BuiltQuery } from '#shared/sql_request/typed_query_builder.ts'
import make_tenanted_select_builder, {
	type TransactionTenantedSelectBuilder,
} from './make_tenanted_select_builder.ts'

const fake_connection = () => {
	const queries: unknown[] = []
	const connection = {
		beginTransaction() {},
		query: async (query: unknown) => {
			queries.push(query)
			return typeof query === 'object'
				? [[[1n]], []]
				: [[], []]
		},
	} as unknown as Connection

	return { connection, queries }
}

test('tenanted select builders allow locking queries only on an active transaction connection', async () => {
	const { connection, queries } = fake_connection()
	let transaction_builder: TransactionTenantedSelectBuilder | undefined
	let locking_query: BuiltQuery<{ client: { client_id: bigint } }> | undefined

	await transaction(connection, async transaction_connection => {
		transaction_builder = make_tenanted_select_builder({
			company_id: 7n,
			mysql: make_mysql_helpers_object(transaction_connection),
		})
		locking_query = transaction_builder
			.from('client')
			.select(() => ['client.client_id'])
			.for_update()
			.build()

		assert.deepEqual(await transaction_builder.get_rows(locking_query), [{ client: { client_id: 1n } }])

		const builder_on_unbranded_connection = make_tenanted_select_builder({
			company_id: 7n,
			mysql: make_mysql_helpers_object(connection),
		})
		assert.throws(
			() => builder_on_unbranded_connection.get_raw_rows(locking_query!.query),
			/active transaction/,
		)
	})

	assert.equal(queries.length, 3)
	assert(transaction_builder)
	assert(locking_query)
	await assert.rejects(
		transaction_builder.get_rows(locking_query),
		/active transaction/,
	)

	const ordinary_builder = make_tenanted_select_builder({
		company_id: 7n,
		mysql: make_mysql_helpers_object(connection),
	})
	await assert.rejects(
		ordinary_builder.get_rows(locking_query),
		/active transaction/,
	)
	assert.equal(queries.length, 3)
})
