import type { Connection } from 'mysql2/promise'
import type { ArbostarUser } from '#arbostar_export/users.d.ts'
import { insert_helper, normalize_name } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'

export type ImportedEmployees = {
	employee_id_by_arbostar_user_id: Map<number, bigint>
	// context.employee_id_by_name plus the imported users, so downstream estimator-name matching
	// resolves to imported employees as well as pre-existing ones.
	employee_id_by_name: Map<string, bigint>
	counts: {
		employees: number
		matched_existing_employees: number
	}
}

const arbostar_user_to_employee_row = (company_id: bigint, arbostar_user: ArbostarUser) => {
	// Identities come straight from ArboStar: its login username → login_name, its personal
	// email → email; empty strings become null. They are NOT checked against the globally
	// unique email/login_name keys — a duplicate currently fails the insert.
	const login_name = arbostar_user.emailid === '' ? null : arbostar_user.emailid
	const personal_email = arbostar_user.personal_email === '' ? null : arbostar_user.personal_email
	// At least one identity column is required (DbInsertableEmployee enforces it), so a
	// user with neither gets a synthesized placeholder email.
	const identity = login_name !== null
		? { email: personal_email, login_name }
		: { email: personal_email ?? `arbostar.user.${arbostar_user.user_id}@import.invalid`, login_name }

	return {
		company_id,
		name: arbostar_user.full_name,
		...identity,
		phone: arbostar_user.emp_phone,
		// An empty hash can never equal a computed PBKDF2 hex digest, so imported employees
		// cannot log in until someone sets a real password for them.
		password_hash: '',
		is_owner: false,
		number_of_password_hash_iterations: 50_000n, // the app's DEFAULT_NUMBER_OF_PASSWORD_HASH_ITERATIONS
	}
}

// users.js → employee. A user whose name already matches an existing employee (normalized) is
// not inserted again — the existing employee id is used for correlation instead.
export const import_employees = async (
	connection: Connection,
	context: ArbostarImportContext,
	users: ArbostarUser[],
): Promise<ImportedEmployees> => {
	const employee_id_by_name = new Map(context.employee_id_by_name)

	const matched: Array<readonly [number, bigint]> = []
	const new_users: ArbostarUser[] = []
	for (const user of users) {
		const existing_employee_id = employee_id_by_name.get(normalize_name(user.full_name))
		if (existing_employee_id === undefined) new_users.push(user)
		else matched.push([user.user_id, existing_employee_id])
	}

	const employee_id_by_arbostar_user_id = new Map(matched)
	for (const user of new_users) {
		const employee_row = arbostar_user_to_employee_row(context.company_id, user)
		const { insert_id } = await insert_helper.insert(connection, 'employee', employee_row)
		employee_id_by_arbostar_user_id.set(user.user_id, insert_id)
		const normalized = normalize_name(user.full_name)
		if (!employee_id_by_name.has(normalized)) employee_id_by_name.set(normalized, insert_id)
	}

	return {
		employee_id_by_arbostar_user_id,
		employee_id_by_name,
		counts: {
			employees: new_users.length,
			matched_existing_employees: matched.length,
		},
	}
}
