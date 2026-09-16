import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'
import type validate_session from '#worker/lib/db/validate_session.ts'
import make_tenanted_select_builder from '#worker/lib/db/make_tenanted_select_builder.ts'
import make_write_helper from '#shared/mysql/write_helper.ts'
import { transaction } from '#shared/mysql/helpers.ts'
import make_mysql_helpers_object from '#shared/mysql/mysql_helpers_object.ts'
import type { Context } from '#worker/lib/context.ts'

export type Session = NonNullable<Awaited<ReturnType<typeof validate_session>>>

const make_context = ({ session, mysql }: { session: Session, mysql: MysqlHelpersObject }): Context => ({
	user: session.employee,
	company: session.company,
	select_builder: make_tenanted_select_builder({ company_id: session.company.company_id, mysql }),
	write_helper: make_write_helper({ connection: mysql.connection, company_id: session.company.company_id }),
	transaction: fn => transaction(mysql.connection, transaction_connection => {
		const transaction_mysql = make_mysql_helpers_object(transaction_connection)
		return fn({
			connection: transaction_connection,
			select_builder: make_tenanted_select_builder({
				company_id: session.company.company_id,
				mysql: transaction_mysql,
			}),
			write_helper: make_write_helper({
				connection: transaction_connection,
				company_id: session.company.company_id,
			}),
		})
	}),
})

export default make_context
