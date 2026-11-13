interface ImportMeta {
	env?: {
		DEV: boolean
	}
}

interface MediaTrackCapabilities {
	zoom?: MediaSettingsRange
}

interface MediaTrackConstraintSet {
	zoom?: ConstrainDouble
}
