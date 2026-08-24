Server functions in `worker/server_functions/**/*.ts` should not be importing `typed_query_builder.ts` to build queries, they should use an auto-tenanted query builder on the context.
