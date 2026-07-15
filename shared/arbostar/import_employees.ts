import type { Connection } from 'mysql2/promise'
import type { ArbostarUser } from '#arbostar_export/users.d.ts'
import { map, filter } from '#shared/array.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { insert_helper, ROWS_PER_BATCH, normalize_name, placeholder_email, run_select } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'

export type ImportedEmployees = {
	employee_id_by_arbostar_user_id: Map<number, bigint>
	// context.employee_id_by_name plus the imported users, so downstream estimator-name matching
	// resolves to imported employees as well as pre-existing ones.
	employee_id_by_name: Map<string, bigint>
	counts: {
		employees_inserted: number
		employees_updated: number
		employees_matched_by_name: number
		employee_identities_downgraded: number
		employees_no_longer_in_export: number
	}
}

// Identity keys are unique across the whole employee table with case-insensitive collation.
const identity_key = (value: string): string => value.trim().toLowerCase()

// users.js → employee, update-or-insert. Correlation is arbostar_user_id; a user whose name
// matches an existing employee (normalized) adopts that row and backfills the correlation, so
// name-matching only ever happens once per employee. Identity columns (email / login_name) are
// INSERT-only: they're login credentials, and overwriting them on re-import could lock a real
// user out. Inserts are checked against every identity in the table up front — a collision
// with another row (any company) downgrades the identity to null / a synthesized placeholder
// rather than relying on a duplicate-key error.
export const import_employees = async (
	connection: Connection,
	context: ArbostarImportContext,
	users: ArbostarUser[],
): Promise<ImportedEmployees> => {
	const employee_id_by_name = new Map(context.employee_id_by_name)
	const correlated = context.existing.employee_id_by_arbostar_user_id

	type Update = { user: ArbostarUser; employee_id: bigint }
	const updates: Update[] = []
	const new_users: ArbostarUser[] = []
	let matched_by_name = 0
	for (const user of users) {
		const correlated_id = correlated.get(user.user_id)
		const name_matched_id = employee_id_by_name.get(normalize_name(user.full_name))
		if (correlated_id !== undefined) updates.push({ user, employee_id: correlated_id })
		else if (name_matched_id !== undefined) {
			matched_by_name += 1
			updates.push({ user, employee_id: name_matched_id })
		} else new_users.push(user)
	}

	if (updates.length > 0) {
		await insert_helper.bulk_update(
			connection,
			'employee',
			'employee_id',
			map(updates, ({ user, employee_id }) => ({
				key: employee_id,
				set: {
					name: user.full_name,
					phone: user.emp_phone,
					is_owner: user.user_type === 'admin',
					arbostar_user_id: BigInt(user.user_id),
				},
			})),
			ROWS_PER_BATCH,
		)
	}

	let identities_downgraded = 0
	const employee_rows = new_users.length === 0 ? [] : await (async () => {
		const identity_query = query_builder<Schema>()
			.from('employee')
			.select(() => ['employee.email', 'employee.login_name'])
			.build()
		const identity_rows = await run_select(connection, identity_query)
		const taken = new Set(map(
			filter(
				[...map(identity_rows, row => row.employee.email), ...map(identity_rows, row => row.employee.login_name)],
				value => value !== null,
			),
			value => identity_key(value!),
		))
		const claim = (value: string): boolean => {
			const key = identity_key(value)
			if (taken.has(key)) return false
			taken.add(key)
			return true
		}

		return map(new_users, user => {
			let login_name = user.emailid === '' ? null : user.emailid
			let email = user.personal_email === '' ? null : user.personal_email
			if (login_name !== null && !claim(login_name)) {
				login_name = null
				identities_downgraded += 1
			}
			if (email !== null && !claim(email)) {
				email = null
				identities_downgraded += 1
			}
			if (email === null && login_name === null) email = placeholder_email(context.company_id, user.user_id)
			// At least one identity is non-null here (DbInsertableEmployee's union requires it).
			const identity = email !== null
				? { email, login_name }
				: { email: null, login_name: login_name! }

			return {
				company_id: context.company_id,
				name: user.full_name,
				...identity,
				phone: user.emp_phone,
				// An empty hash can never equal a computed PBKDF2 hex digest, so imported employees
				// cannot log in until someone sets a real password for them.
				password_hash: '',
				is_owner: user.user_type === 'admin',
				number_of_password_hash_iterations: 50_000n, // the app's DEFAULT_NUMBER_OF_PASSWORD_HASH_ITERATIONS
				arbostar_user_id: BigInt(user.user_id),
			}
		})
	})()

	const employee_id_by_arbostar_user_id = new Map(map(updates, ({ user, employee_id }) => [user.user_id, employee_id] as const))
	if (employee_rows.length > 0) {
		const { insert_ids } = await insert_helper.bulk_insert(connection, 'employee', employee_rows, ROWS_PER_BATCH)
		new_users.forEach((user, index) => employee_id_by_arbostar_user_id.set(user.user_id, insert_ids[index]!))
	}
	for (const user of users) {
		const normalized = normalize_name(user.full_name)
		if (!employee_id_by_name.has(normalized)) {
			employee_id_by_name.set(normalized, employee_id_by_arbostar_user_id.get(user.user_id)!)
		}
	}

	const incoming_user_ids = new Set(map(users, user => user.user_id))
	const no_longer_in_export = filter([...correlated.keys()], user_id => !incoming_user_ids.has(user_id)).length

	return {
		employee_id_by_arbostar_user_id,
		employee_id_by_name,
		counts: {
			employees_inserted: employee_rows.length,
			employees_updated: updates.length,
			employees_matched_by_name: matched_by_name,
			employee_identities_downgraded: identities_downgraded,
			employees_no_longer_in_export: no_longer_in_export,
		},
	}
}
