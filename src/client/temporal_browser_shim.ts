// Used by the esbuild client build (via alias) to replace @js-temporal/polyfill.
// TypeScript will still resolve types from the polyfill, though.
export const Temporal = (globalThis as any).Temporal
