-- 0007-employee-session-revamp.sql

ALTER TABLE employee_session
	DROP INDEX uq_employee_session_identifier,
	CHANGE COLUMN session_identifier identifier BINARY(16) NOT NULL,
	CHANGE COLUMN enabled invalidated BIT(1) NOT NULL DEFAULT 0,
	ADD COLUMN sign_in_user_agent TEXT NOT NULL,
	ADD COLUMN signed_in_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	ADD COLUMN last_seen_user_agent TEXT NOT NULL,
	ADD COLUMN last_seen_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
	ADD COLUMN expire_at DATETIME NOT NULL,
	ADD UNIQUE KEY uq_employee_session_identifier (identifier);
