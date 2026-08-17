# Clock sessions

Schema landed in migration 0041. Sessions feed real project cost and time-spent reporting. They are not used for payroll.

Model summary:

- A clock_session is an immutable declaration of work: one project, a fixed set of line items. Changing the line item set closes the session and opens a successor via `supersedes_clock_session_id`. The unique key on that column limits each session to one successor.
- clock_session has no authoritative span. Derive it from min(clock_in) and max(clock_out) of its clock_session_employee rows.
- clock_session_employee holds all actual time. One row per person per stint. clock_out NULL means still on the clock. The `open_employee_id` generated column plus its unique key enforce at most one open stint per employee anywhere. That key also answers "who is clocked in right now" (`WHERE open_employee_id IS NOT NULL`) and "is employee X clocked in".
- clock_in_day is the company-local date of clock_in. The app derives it, the same derivation as clock_session.work_date. It is not a generated column on purpose: a SQL expression over clock_in would give the UTC day.

Rules for the module that writes stints (enforce with runtime asserts, test the throws):

- `clock_out >= clock_in`.
- clock_in_day equals clock_in in the company's timezone, on insert and on every clock_in edit.
- A stint never moves to another session or employee. History only records clock_in/clock_out changes, so a move would be invisible to the audit trail.
- Supersede handoff, in one transaction: close the open stints in the old session first, then insert the open stints in the successor. `uq_cse_open_employee` is checked per statement, so the reverse order fails.
- Every clock_in/clock_out edit writes a clock_session_employee_history row with previous and new values. A delete, if ever allowed, is a history row with previous values and NULL new values.

Timezone:

- company.timezone is an IANA zone name with no default. Company creation must supply it. Validate against `Intl.supportedValuesOf('timeZone')`.
- Derive work_date and clock_in_day in the app. SQL-side CONVERT_TZ needs the MySQL timezone tables loaded, so avoid it.

Possible later changes:

- `open_employee_id` may be removed if the one-open-stint rule moves to the app. Drop the generated column and its unique key together.
- `idx_clock_session_crew` is a bare crew_id index until real query needs surface.
- No per-employee company/time index. Company-wide reports go through clock_session (`idx_clock_session_company_work_date`) and join stints through `idx_cse_session`.
