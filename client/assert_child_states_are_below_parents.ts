type GlobbedStateModule = {
	path: string
	export: {
		name: string
	} | {
		asr_state: {
			name: string
		}
	}
}

const path_is_child_of = (path: string, supposed_parent: string) => path.length > supposed_parent.length
	&& path.startsWith(supposed_parent)

const strip_file_name_from_end_of_path = (file_path: string) => file_path.split(/[\/\\]/g)
	.slice(0, -1)
	.join(`/`) + `/`

export default (states: GlobbedStateModule[]) => {
	const paths_and_names = states.map(({ path, export: etc }) => ({
		path,
		name: `name` in etc ? etc.name : etc.asr_state.name,
	}))
	const state_name_to_directory_path = new Map<string, string>(
		paths_and_names.map(({ path, name }) => [ name, path ])
	)

	const incorrect_states = paths_and_names.filter(({ path, name }) => {
		const name_chunks = name.split(`.`)
		const parent_state = name_chunks.slice(0, -1).join(`.`)

		if (!parent_state || name_chunks.slice(-1)[0] === `default`) {
			return false
		}

		const parent_path = state_name_to_directory_path.get(parent_state)

		if (!parent_path) {
			throw new Error(`Something ostensibly impossible has occurred`)
		}

		const child_state_directory = strip_file_name_from_end_of_path(path)
		const parent_state_directory = strip_file_name_from_end_of_path(parent_path)

		const child_is_in_subdirectory_of_parent_state = path_is_child_of(
			child_state_directory,
			parent_state_directory
		)

		if (!child_is_in_subdirectory_of_parent_state) {
			console.error(`"${ name }" is supposed to be in a subdirectory of "${ parent_state_directory }" but it's not!`)
		}

		return !child_is_in_subdirectory_of_parent_state
	})

	if (incorrect_states.length > 0) {
		throw new Error(`Put these states in the correct directory: ${ incorrect_states.map(({ name }) => name).join(`, `) }`)
	}
}
