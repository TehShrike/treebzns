import ts from 'typescript'
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

const configPath = resolve(PROJECT_ROOT, 'tsconfig.json')
const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, PROJECT_ROOT)

const fnDir = join(PROJECT_ROOT, 'worker', 'server_functions')
const fnFiles = readdirSync(fnDir)
	.filter(f => f.endsWith('.fns.ts'))
	.map(f => join(fnDir, f))

const program = ts.createProgram(
	[...new Set([...parsed.fileNames, ...fnFiles])],
	parsed.options,
)
const checker = program.getTypeChecker()

type FnEntry = { arg: string; returns: string }
const allFunctions = new Map<string, FnEntry>()

for (const filePath of fnFiles) {
	const sf = program.getSourceFile(filePath)
	if (!sf) {
		console.error(`could not load ${filePath}`)
		continue
	}

	function visit(node: ts.Node): void {
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.name.text === 'functions' &&
			node.initializer
		) {
			const functionsType = checker.getTypeAtLocation(node.initializer)
			for (const prop of checker.getPropertiesOfType(functionsType)) {
				const propType = checker.getTypeOfSymbol(prop)

				const validatorProp = propType.getProperty('validator')
				if (!validatorProp) continue
				const isValidProp = checker.getTypeOfSymbol(validatorProp).getProperty('is_valid')
				if (!isValidProp) continue
				const isValidSig = checker.getSignaturesOfType(
					checker.getTypeOfSymbol(isValidProp),
					ts.SignatureKind.Call,
				)[0]
				if (!isValidSig) continue
				const predicate = checker.getTypePredicateOfSignature(isValidSig)
				if (!predicate?.type) continue
				const argType = checker.typeToString(predicate.type)

				const fnProp = propType.getProperty('fn')
				if (!fnProp) continue
				const fnSig = checker.getSignaturesOfType(
					checker.getTypeOfSymbol(fnProp),
					ts.SignatureKind.Call,
				)[0]
				if (!fnSig) continue
				const rawReturn = checker.getReturnTypeOfSignature(fnSig)
				const typeArgs = checker.getTypeArguments(rawReturn as ts.TypeReference)
				const returnType = checker.typeToString(typeArgs[0] ?? rawReturn)

				allFunctions.set(prop.name, { arg: argType, returns: returnType })
			}
		}
		ts.forEachChild(node, visit)
	}
	visit(sf)
}

const entries = [...allFunctions.entries()]
	.map(([name, { arg, returns }]) => `\t${name}: (arg: ${arg}) => Promise<${returns}>`)
	.join('\n')

const outputPath = join(PROJECT_ROOT, 'client', 'lib', 'server_functions.d.ts')
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `declare const server_functions: {\n${entries}\n}\nexport default server_functions\n`)
console.log(`wrote ${outputPath}`)
