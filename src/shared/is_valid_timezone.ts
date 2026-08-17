let supported_timezones: Set<string> | null = null

export default (timezone: string): boolean => {
	if (!supported_timezones) {
		supported_timezones = new Set(Intl.supportedValuesOf('timeZone'))
	}
	return supported_timezones.has(timezone)
}
