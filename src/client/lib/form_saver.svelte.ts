const error_message = (err: any): string => err?.body?.message ?? err?.message ?? `Something went wrong`

const form_saver = <VALUES_TO_SAVE>({ form, on_save }: {
	form: { readonly values_to_save: VALUES_TO_SAVE }
	on_save: (sent: VALUES_TO_SAVE) => Promise<void>
}) => {
	let saving = $state(false)
	let save_error = $state<string | null>(null)

	const save = async () => {
		save_error = null
		saving = true
		try {
			await on_save(form.values_to_save)
		} catch (err) {
			save_error = error_message(err)
		} finally {
			saving = false
		}
	}

	const save_cb = (event: SubmitEvent) => {
		event.preventDefault()
		void save()
	}

	return {
		get saving() { return saving },
		get save_error() { return save_error },
		save,
		save_cb,
	}
}

export type FormSaver = ReturnType<typeof form_saver>

export default form_saver
