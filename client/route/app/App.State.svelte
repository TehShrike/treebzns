<script module lang="ts">
	import { state_type } from '#client/lib/state_type.ts'
	import f3tch from '#shared/f3tch.ts'
	import type { schema } from '#schema/constants.ts'

	type SessionResponse = {
		employee: Pick<DbEmployee, typeof schema.employee.employee_id | typeof schema.employee.company_id | typeof schema.employee.name | typeof schema.employee.email | typeof schema.employee.phone | typeof schema.employee.is_owner>
		company: Pick<DbCompany, typeof schema.company.company_id | typeof schema.company.name | typeof schema.company.brand_color | typeof schema.company.default_initial_project_document_id>
	}

	export const asr_state = state_type({
		name: `app`,
		route: `/app`,
		resolve: async () => {
			const session = await f3tch(`/api/session`)
			if (!session) {
				return Promise.reject({
					redirectTo: {
						state: 'login',
					}
				})
			}

			return {
				session
			}
		},
	})
</script>

<script>
	let { session }: { session: SessionResponse } = $props()
</script>

<div>
	<h1>App</h1>
	<p>Welcome, {session.employee.name}!</p>
</div>
