# MySQL users

Replace each `<password>` placeholder before you run the statements.

## CFW

```sql
CREATE USER 'treebzns_cfw'@'%'
	IDENTIFIED WITH caching_sha2_password BY '<password>';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE TEMPORARY TABLES, LOCK TABLES
	ON `turbocedar`.* TO 'treebzns_cfw'@'%';
```

## CI Migrator

```sql
CREATE USER 'treebzns_ci_migrator'@'%'
	IDENTIFIED WITH caching_sha2_password BY '<password>';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, REFERENCES, INDEX, ALTER,
	CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, CREATE VIEW, SHOW VIEW,
	CREATE ROUTINE, ALTER ROUTINE, EVENT, TRIGGER
	ON `turbocedar`.* TO 'treebzns_ci_migrator'@'%';
```
