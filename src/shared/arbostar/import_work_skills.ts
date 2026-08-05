import type { Connection } from 'mysql2/promise'
import type { ArbostarCrewRole } from '#arbostar_export/crew_roles.d.ts'
import assert from '#shared/assert.ts'
import { map, filter } from '#shared/array.ts'
import { write_helper, ROWS_PER_BATCH, normalize_name, money } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'

export type ImportedWorkSkills = {
	counts: {
		work_skills_inserted: number
		work_skills_updated: number
	}
}

// crew_roles.js → work_skill, update-or-insert. The name is derived from the role: when the
// code (crew_name) ends with digits, they're appended to crew_full_name — CL0-CL3 all share
// the full name 'Arborist Climber', so the digits are what keep the four skills distinct
// ('Arborist Climber 0' … 'Arborist Climber 3'). work_skill has no ArboStar correlation
// column, so the derived name is the natural key (like item_type): a re-run matches by
// normalized name and overwrites hourly_rate (ArboStar is the source of truth). Skills
// absent from the export are never deleted.
export const import_work_skills = async (
	connection: Connection,
	context: ArbostarImportContext,
	crew_roles: ArbostarCrewRole[],
): Promise<ImportedWorkSkills> => {
	const skills = map(crew_roles, role => {
		const digits = /(\d+)$/.exec(role.crew_name)?.[1]
		return {
			name: digits === undefined ? role.crew_full_name : `${role.crew_full_name} ${digits}`,
			hourly_rate: money(role.crew_rate),
		}
	})
	assert(
		new Set(map(skills, skill => normalize_name(skill.name))).size === skills.length,
		'every crew role derives a distinct work skill name',
	)

	const existing = context.existing.work_skill_id_by_name
	const updates = filter(skills, skill => existing.has(normalize_name(skill.name)))
	const inserts = filter(skills, skill => !existing.has(normalize_name(skill.name)))

	if (updates.length > 0) {
		await write_helper.bulk_update(
			connection,
			'work_skill',
			'work_skill_id',
			map(updates, skill => ({
				key: existing.get(normalize_name(skill.name))!,
				set: { hourly_rate: skill.hourly_rate },
			})),
			ROWS_PER_BATCH,
		)
	}
	if (inserts.length > 0) {
		await write_helper.bulk_insert(
			connection,
			'work_skill',
			map(inserts, skill => ({
				company_id: context.company_id,
				name: skill.name,
				hourly_rate: skill.hourly_rate,
			})),
			ROWS_PER_BATCH,
		)
	}

	return {
		counts: {
			work_skills_inserted: inserts.length,
			work_skills_updated: updates.length,
		},
	}
}
