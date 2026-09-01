import type { Connection } from 'mysql2/promise'
import type { ArbostarUser } from '#arbostar_export/users.d.ts'
import { DEFAULT_NUMBER_OF_PASSWORD_HASH_ITERATIONS } from '#worker/lib/employee.ts'
import { map, filter } from '#shared/array.ts'
import { write_helper, ROWS_PER_BATCH, normalize_name, identity_key, placeholder_email } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'

export type ImportedEmployees = {
	employee_id_by_arbostar_user_id: Map<number, bigint>
	// context.employee_id_by_name plus the imported users, so downstream estimator-name matching
	// resolves to imported employees as well as pre-existing ones.
	employee_id_by_name: Map<string, bigint>
	counts: {
		employees_inserted: number
		employees_updated: number
		employees_matched_by_identity: number
		employees_matched_by_name: number
		employees_inactive_ignored: number
		employee_identities_downgraded: number
		employees_no_longer_in_export: number
	}
}

// users.js → employee, update-or-insert. Only active ('yes') ArboStar accounts are imported —
// suspended/inactive ones are ignored entirely, on first import and re-imports (their
// estimator names survive only as lead_details text). Correlation is arbostar_user_id; an
// uncorrelated user whose login/email matches an existing employee's login_name/email — or,
// failing that, whose name matches (normalized) — adopts that row and backfills the
// correlation, so identity/name matching only ever happens once per employee. That's how the
// account a person created in-app before the first import becomes their ArboStar-linked row.
// Identity columns (email / login_name) are INSERT-only: they're login credentials, and
// overwriting them on re-import could lock a real user out. Inserts are checked against every
// identity in the table up front — a collision with another row (any company) downgrades the
// identity to null / a synthesized placeholder rather than relying on a duplicate-key error.
// is_owner is an in-app permission: inserted as false, never updated.
export const import_employees = async (
	connection: Connection,
	context: ArbostarImportContext,
	users: ArbostarUser[],
	// The deliberately non-tenanted identity lookup, injected by the orchestrator (see
	// load_taken_identity_keys in import_arbostar_export.ts).
	load_taken_identity_keys: () => Promise<Set<string>>,
): Promise<ImportedEmployees> => {
	const employee_id_by_name = new Map(context.employee_id_by_name)
	const adoptable_by_identity = new Map(context.employee_id_by_identity)
	const correlated = context.existing.employee_id_by_arbostar_user_id

	const active_users = filter(users, user => user.active_status === 'yes')

	const identity_match = (user: ArbostarUser): bigint | undefined => {
		for (const value of [user.emailid, user.personal_email, user.user_email]) {
			if (value === '') continue
			const employee_id = adoptable_by_identity.get(identity_key(value))
			if (employee_id !== undefined) return employee_id
		}
		return undefined
	}

	type Update = { user: ArbostarUser; employee_id: bigint }
	const updates: Update[] = []
	const new_users: ArbostarUser[] = []
	let matched_by_identity = 0
	let matched_by_name = 0
	for (const user of active_users) {
		const correlated_id = correlated.get(user.user_id)
		const identity_matched_id = correlated_id === undefined ? identity_match(user) : undefined
		const name_matched_id = employee_id_by_name.get(normalize_name(user.full_name))
		const adopted_id = identity_matched_id ?? name_matched_id
		if (correlated_id !== undefined) updates.push({ user, employee_id: correlated_id })
		else if (adopted_id !== undefined) {
			if (identity_matched_id !== undefined) matched_by_identity += 1
			else matched_by_name += 1
			updates.push({ user, employee_id: adopted_id })
		} else new_users.push(user)
		if (adopted_id !== undefined) {
			for (const [key, employee_id] of adoptable_by_identity) {
				if (employee_id === adopted_id) adoptable_by_identity.delete(key)
			}
		}
	}

	if (updates.length > 0) {
		await write_helper.bulk_update(
			connection,
			'employee',
			'employee_id',
			map(updates, ({ user, employee_id }) => ({
				key: employee_id,
				set: {
					name: user.full_name,
					phone: user.emp_phone,
					arbostar_user_id: BigInt(user.user_id),
				},
			})),
			ROWS_PER_BATCH,
		)
	}

	let identities_downgraded = 0
	const employee_rows = new_users.length === 0 ? [] : await (async () => {
		const taken = await load_taken_identity_keys()
		const claim = (value: string): boolean => {
			const key = identity_key(value)
			if (taken.has(key)) return false
			taken.add(key)
			return true
		}

		return map(new_users, (user, index) => {
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
				is_owner: false,
				number_of_password_hash_iterations: DEFAULT_NUMBER_OF_PASSWORD_HASH_ITERATIONS,
				arbostar_user_id: BigInt(user.user_id),
				estimator_sort: context.next_estimator_sort + BigInt(index),
			}
		})
	})()

	const employee_id_by_arbostar_user_id = new Map(map(updates, ({ user, employee_id }) => [user.user_id, employee_id] as const))
	if (employee_rows.length > 0) {
		const { insert_ids } = await write_helper.bulk_insert(connection, 'employee', employee_rows, ROWS_PER_BATCH)
		new_users.forEach((user, index) => employee_id_by_arbostar_user_id.set(user.user_id, insert_ids[index]!))
	}
	for (const user of active_users) {
		const normalized = normalize_name(user.full_name)
		if (!employee_id_by_name.has(normalized)) {
			employee_id_by_name.set(normalized, employee_id_by_arbostar_user_id.get(user.user_id)!)
		}
	}

	// Counted against the full user list, not just active ones — an ignored inactive user that
	// was imported before the active filter existed is still in the export, just not importable.
	const incoming_user_ids = new Set(map(users, user => user.user_id))
	const no_longer_in_export = filter([...correlated.keys()], user_id => !incoming_user_ids.has(user_id)).length

	return {
		employee_id_by_arbostar_user_id,
		employee_id_by_name,
		counts: {
			employees_inserted: employee_rows.length,
			employees_updated: updates.length,
			employees_matched_by_identity: matched_by_identity,
			employees_matched_by_name: matched_by_name,
			employees_inactive_ignored: users.length - active_users.length,
			employee_identities_downgraded: identities_downgraded,
			employees_no_longer_in_export: no_longer_in_export,
		},
	}
}
