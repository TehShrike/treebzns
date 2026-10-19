import { build, context } from 'esbuild'
import { mkdirSync } from 'fs'
import type { CompileOptions } from "svelte/compiler";
import sveltePlugin from 'esbuild-svelte'

const is_watch = process.argv.includes('--watch')

const dev = is_watch
const compiler_options: CompileOptions = {
	dev,
}

mkdirSync(`src/public/build`, {
	recursive: true
})

const get_build_options = () => ({
	alias: {
		'@js-temporal/polyfill': './src/client/temporal_browser_shim.ts',
	},
	entryPoints: ['src/client/index.ts'],
	conditions: ['client'],
	bundle: true,
	splitting: true,
	outdir: `src/public/build`,
	plugins: [
		// @ts-expect-error - not sure what's up with TS not picking up the types
		sveltePlugin({
			compilerOptions: compiler_options,
		}),
	],
	format: 'esm' as const,
	define: {
		'import.meta.env.DEV': JSON.stringify(dev),
	},
	sourcemap: true
})

const get_temporal_polyfill_build_options = () => ({
	entryPoints: ['src/client/temporal_polyfill.ts'],
	bundle: true,
	outfile: `src/public/build/temporal_polyfill.js`,
	format: 'iife' as const,
	sourcemap: true
})

if (is_watch) {
	const [app_ctx, polyfill_ctx] = await Promise.all([
		context(get_build_options()),
		context(get_temporal_polyfill_build_options()),
	])
	console.log('Watching for changes...')
	await Promise.all([app_ctx.watch(), polyfill_ctx.watch()])
} else {
	await Promise.all([
		build(get_build_options()),
		build(get_temporal_polyfill_build_options()),
	])
	console.log('Build complete')
}
