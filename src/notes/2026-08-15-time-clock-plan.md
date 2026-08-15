# Time clock plan (2026-08-15)

Design discussion for the first todo item: clocking employees in and out of jobs, tying
clock records to `project_crew` rows (the scheduled visit) instead of the current
`project_id` + `work_date` pair.

## Status

Discussion in progress (voice session — decisions get appended here as they land).

## Current state

- `time_entry` already exists in the schema but is unused by application code and gets
	nothing from the ArboStar import. Columns: `employee_id`, `project_id`, `work_date`,
	`clock_in`, `clock_out` (nullable), `regular_hours DECIMAL(5,2) DEFAULT 0`.
- `project_crew` is the scheduled visit: (`project_id`, `crew_id`, `work_date`) unique,
	with `day_order` and `start_time`. `project_crew_employee` is the per-visit roster.
- Notes context (schema_thinking.md, screens_needed.md):
	- Foreman clocks the whole crew in/out; gated by a permission, not a modeled crew leader.
	- Clock-in happens when starting to drive, while pulling up directions; sends a
		confirmation text.
	- Foreman can add someone to the job later if they show up late, and can clock
		individuals onto/off of the crew.
	- Reporting wants estimated vs. actual hours per project.

## Proposed shape (up for discussion)

Replace `time_entry.project_id` + `work_date` with `project_crew_id`. Keep `employee_id`
directly on the row (rather than referencing `project_crew_employee`) so clocking and
roster membership stay independently editable — or require roster membership; see open
questions.

## Open questions

1. Reference `project_crew_id` + `employee_id`, or the `project_crew_employee` roster row?
2. Multiple in/out pairs per employee per visit (lunch, split days)?
3. Is drive time distinguished from work time (entry kind), or one undifferentiated span?
4. What is `regular_hours` for — keep, drop, or derive? Overtime/rounding story?
5. Invariants: one open entry per employee at a time? Enforced where?
6. What happens to time entries when a visit is unscheduled/moved?

## Decisions

(none yet)
