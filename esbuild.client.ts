import { build, context } from 'esbuild'
import { mkdirSync } from 'fs'
import type { CompileOptions } from "svelte/compiler";
import sveltePlugin from 'esbuild-svelte'
import { for_each } from '#shared/array.ts'

const is_watch = process.argv.includes('--watch')

const dev = is_watch
const compiler_options: CompileOptions = {
	dev,
}

mkdirSync(`public/build`, {
	recursive: true
})

const get_build_options = () => ({
	alias: {
		'@js-temporal/polyfill': './client/temporal_browser_shim.ts',
	},
	entryPoints: ['client/index.ts'],
	bundle: true,
	splitting: true,
	outdir: `public/build`,
	plugins: [
		// @ts-expect-error - not sure what's up with TS not picking up the types
		sveltePlugin({
			compilerOptions: compiler_options,
		}),
	],
	format: 'esm' as const,
	target: 'es2020',
	define: {
		// '__IS_DEV__': JSON.stringify(dev),
	},
	sourcemap: true
})

if (is_watch) {
	const ctx = await context(get_build_options())
	console.log('Watching for changes...')
	await ctx.watch()
} else {
	await build(get_build_options())
	console.log('Build complete')
}
