import { createConnection } from 'mysql2/promise'
import type { RowDataPacket } from 'mysql2'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from '#shared/assert.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATION_DIR = join(__dirname, '..', 'migration')

type Migration = {
	number: number
	filename: string
}

function requireEnv(key: string): string {
	const val = process.env[key]
	if (val === undefined) throw new Error(`Missing env var: ${key}`)
	return val
}

function readMigrations(): Migration[] {
	const migrations = readdirSync(MIGRATION_DIR)
		.filter(filename => filename.endsWith('.sql'))
		.map(filename => {
			const match = filename.match(/^(\d+)-/)
			assert(match, `Migration file name must start with a number: "${filename}"`)
			return { number: Number(match[1]), filename }
		})
		.sort((a, b) => a.number - b.number)

	migrations.forEach((migration, index) => {
		if (index === 0) return
		const previous = migrations[index - 1]!
		assert(
			migration.number !== previous.number,
			`Duplicate migration number ${migration.number}: "${previous.filename}" and "${migration.filename}"`,
		)
	})

	return migrations
}

const conn = await createConnection({
	host: requireEnv('MYSQL_HOST'),
	user: requireEnv('MYSQL_USER'),
	password: requireEnv('MYSQL_PASS'),
	database: requireEnv('MYSQL_DB'),
	// Migration files contain multiple statements (e.g. 0000-initial.sql).
	multipleStatements: true,
})

try {
	await conn.query(`
		CREATE TABLE IF NOT EXISTS migration (
			migration_number INT UNSIGNED NOT NULL,
			ran_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
			PRIMARY KEY (migration_number)
		) ENGINE=InnoDB
	`)

	const [rows] = await conn.query<RowDataPacket[]>(
		`SELECT MAX(migration_number) AS max FROM migration`,
	)
	const lastRan: number | null = rows[0]!.max

	const migrations = readMigrations()
	const pending = migrations.filter(
		migration => lastRan === null || migration.number > lastRan,
	)

	if (pending.length === 0) {
		console.log(`No pending migrations (last ran: ${lastRan ?? 'none'})`)
	} else {
		for (const migration of pending) {
			const sql = readFileSync(join(MIGRATION_DIR, migration.filename), 'utf8')
			console.log(`Running ${migration.filename}...`)
			await conn.query(sql)
			await conn.query(`INSERT INTO migration (migration_number) VALUES (?)`, [
				migration.number,
			])
			console.log(`  done`)
		}
		console.log(`Ran ${pending.length} migration(s)`)
	}
} finally {
	await conn.end()
}
