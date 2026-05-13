import { build, context } from 'esbuild'

const watch = process.argv.includes('--watch')

const build_options = {
	entryPoints: ['worker/index.ts'],
	bundle: true,
	outfile: 'build/worker/worker.js',
	format: 'esm' as const,
	target: 'es2020',
}

if (watch) {
	const ctx = await context(build_options)
	await ctx.watch()
	console.log('Watching worker for changes...')
} else {
	await build(build_options)
	console.log('Worker build complete')
}
