declare module 'sql-tagged-template-literal' {
	function tag(sql: TemplateStringsArray, ...values: any[]): string
	export default tag
}
