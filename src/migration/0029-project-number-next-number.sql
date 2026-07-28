ALTER TABLE project_number RENAME COLUMN last_number TO next_number;
ALTER TABLE project_number ALTER COLUMN next_number SET DEFAULT 1;
UPDATE project_number SET next_number = next_number + 1;
