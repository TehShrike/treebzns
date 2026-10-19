import { filter } from '#shared/array.ts'

export const format_project_address = (project: Pick<DbProject, 'address_line_1' | 'address_line_2' | 'city'>) =>
	filter([project.address_line_1, project.address_line_2, project.city], Boolean).join(`, `)
