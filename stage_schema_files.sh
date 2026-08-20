#!/bin/sh
set -e
cd "$(dirname "$0")"
git add \
	schema/current_schema.sql \
	schema/all_table_column_names.ts \
	schema/insertable_table_column_names.ts \
	schema/types.ts \
	schema/type
