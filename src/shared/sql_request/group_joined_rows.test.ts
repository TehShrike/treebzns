import { test } from 'node:test'
import * as assert from 'node:assert'
import group_joined_rows, { type GroupedRow, type GroupingSpec } from './group_joined_rows.ts'

type AssertEqual<A, B> =
	(<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

// Left-joined tables mirror the query builder's shape: the matched row or an all-null row.
type ExampleRow = {
	client: { client_id: bigint; name: string }
	client_address:
		| { client_address_id: bigint; client_id: bigint; city: string }
		| { client_address_id: null; client_id: null; city: null }
	client_contact:
		| { client_contact_id: bigint; name: string; arbostar_email_data: string | null }
		| { client_contact_id: null; name: null; arbostar_email_data: null }
}

const client = (client_id: bigint, name: string) => ({ client_id, name })
const address = (client_address_id: bigint, client_id: bigint, city: string): ExampleRow['client_address'] => ({ client_address_id, client_id, city })
const contact = (client_contact_id: bigint, name: string, arbostar_email_data: string | null): ExampleRow['client_contact'] => ({ client_contact_id, name, arbostar_email_data })
const no_address: ExampleRow['client_address'] = { client_address_id: null, client_id: null, city: null }
const no_contact: ExampleRow['client_contact'] = { client_contact_id: null, name: null, arbostar_email_data: null }

test('groups joined rows into one parent with an array of children', () => {
	const rows: ExampleRow[] = [
		{ client: client(1n, 'Ann'), client_address: address(10n, 1n, 'Reno'), client_contact: no_contact },
		{ client: client(1n, 'Ann'), client_address: address(11n, 1n, 'Sparks'), client_contact: no_contact },
		{ client: client(2n, 'Bob'), client_address: address(12n, 2n, 'Fernley'), client_contact: no_contact },
	]

	const grouped = group_joined_rows(rows, {
		table: 'client',
		key: 'client_id',
		children: {
			client_addresses: { table: 'client_address', key: 'client_address_id' },
			client_contacts: { table: 'client_contact', key: 'client_contact_id' },
		},
	})

	// These type reads sit above the deepStrictEqual because its `asserts actual is T` narrows
	// `grouped` to the expected literal's type (where an empty array is never[]).
	type GroupedAddress = (typeof grouped)[number]['client_addresses'][number]
	type GroupedContact = (typeof grouped)[number]['client_contacts'][number]
	const grouping_dropped_the_all_null_variant: AssertEqual<GroupedAddress['city'], string> = true
	const contact_name_is_not_null: AssertEqual<GroupedContact['name'], string> = true
	const genuinely_nullable_column_keeps_null: AssertEqual<GroupedContact['arbostar_email_data'], string | null> = true
	assert.ok(grouping_dropped_the_all_null_variant && contact_name_is_not_null && genuinely_nullable_column_keeps_null)

	assert.deepStrictEqual(grouped, [
		{
			client: client(1n, 'Ann'),
			client_addresses: [address(10n, 1n, 'Reno'), address(11n, 1n, 'Sparks')],
			client_contacts: [],
		},
		{
			client: client(2n, 'Bob'),
			client_addresses: [address(12n, 2n, 'Fernley')],
			client_contacts: [],
		},
	])
})

test('an unmatched left join produces an empty child array', () => {
	const rows: ExampleRow[] = [
		{ client: client(1n, 'Ann'), client_address: no_address, client_contact: no_contact },
	]

	const grouped = group_joined_rows(rows, {
		table: 'client',
		key: 'client_id',
		children: {
			client_addresses: { table: 'client_address', key: 'client_address_id' },
		},
	})

	assert.deepStrictEqual(grouped, [{ client: client(1n, 'Ann'), client_addresses: [] }])
})

test('two sibling joins each deduplicate their cross product', () => {
	const ann = client(1n, 'Ann')
	const rows: ExampleRow[] = [
		{ client: ann, client_address: address(10n, 1n, 'Reno'), client_contact: contact(20n, 'Carol', null) },
		{ client: ann, client_address: address(10n, 1n, 'Reno'), client_contact: contact(21n, 'Dan', null) },
		{ client: ann, client_address: address(11n, 1n, 'Sparks'), client_contact: contact(20n, 'Carol', null) },
		{ client: ann, client_address: address(11n, 1n, 'Sparks'), client_contact: contact(21n, 'Dan', null) },
	]

	const grouped = group_joined_rows(rows, {
		table: 'client',
		key: 'client_id',
		children: {
			client_addresses: { table: 'client_address', key: 'client_address_id' },
			client_contacts: { table: 'client_contact', key: 'client_contact_id' },
		},
	})

	assert.deepStrictEqual(grouped, [
		{
			client: ann,
			client_addresses: [address(10n, 1n, 'Reno'), address(11n, 1n, 'Sparks')],
			client_contacts: [contact(20n, 'Carol', null), contact(21n, 'Dan', null)],
		},
	])
})

test('nested children group under their own parent', () => {
	type NestedRow = ExampleRow & {
		appointment:
			| { appointment_id: bigint; description: string }
			| { appointment_id: null; description: null }
	}
	const appointment = (appointment_id: bigint, description: string): NestedRow['appointment'] => ({ appointment_id, description })
	const no_appointment: NestedRow['appointment'] = { appointment_id: null, description: null }

	const ann = client(1n, 'Ann')
	const rows: NestedRow[] = [
		{ client: ann, client_address: address(10n, 1n, 'Reno'), client_contact: no_contact, appointment: appointment(30n, 'estimate') },
		{ client: ann, client_address: address(10n, 1n, 'Reno'), client_contact: no_contact, appointment: appointment(31n, 'work') },
		{ client: ann, client_address: address(11n, 1n, 'Sparks'), client_contact: no_contact, appointment: no_appointment },
	]

	const grouped = group_joined_rows(rows, {
		table: 'client',
		key: 'client_id',
		children: {
			client_addresses: {
				table: 'client_address',
				key: 'client_address_id',
				children: {
					appointments: { table: 'appointment', key: 'appointment_id' },
				},
			},
		},
	})

	assert.deepStrictEqual(grouped, [
		{
			client: ann,
			client_addresses: [
				{
					client_address: address(10n, 1n, 'Reno'),
					appointments: [appointment(30n, 'estimate'), appointment(31n, 'work')],
				},
				{
					client_address: address(11n, 1n, 'Sparks'),
					appointments: [],
				},
			],
		},
	])
})

test('a spec without children deduplicates the parent rows', () => {
	const rows: ExampleRow[] = [
		{ client: client(1n, 'Ann'), client_address: address(10n, 1n, 'Reno'), client_contact: no_contact },
		{ client: client(1n, 'Ann'), client_address: address(11n, 1n, 'Sparks'), client_contact: no_contact },
	]

	const grouped = group_joined_rows(rows, { table: 'client', key: 'client_id' })

	assert.deepStrictEqual(grouped, [client(1n, 'Ann')])
})

test('a row missing the key column fails the assertion', () => {
	const rows = [{ client: { name: 'Ann' } }] as unknown as ExampleRow[]

	assert.throws(
		() => group_joined_rows(rows, { table: 'client', key: 'client_id' }),
		/the "client" object has a "client_id" column/,
	)
})

test('the spec and result types stay linked', () => {
	const spec = {
		table: 'client',
		key: 'client_id',
		children: {
			client_addresses: { table: 'client_address', key: 'client_address_id' },
		},
	} as const satisfies GroupingSpec<ExampleRow>

	type Result = GroupedRow<ExampleRow, typeof spec>
	const has_client_and_addresses: AssertEqual<keyof Result, 'client' | 'client_addresses'> = true
	assert.ok(has_client_and_addresses)
})
