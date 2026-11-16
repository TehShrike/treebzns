import error_message from '#lib/error_message.ts'

const form_saver = <VALUES, RESULT>({ form, send }: {
	form: { start_save: () => { values: VALUES, commit: (result: RESULT) => void, discard: () => void }, needs_to_be_saved: boolean }
	send: (values: VALUES) => Promise<RESULT>
}) => {
	let save_error_message = $state<string | null>(null)
	let saving = $state(false)

	const save = async () => {
		save_error_message = null
		saving = true
		try {
			const pending = form.start_save()
			const result = await send(pending.values).catch((err: unknown) => {
				pending.discard()
				throw err
			})
			pending.commit(result)
		} catch (err) {
			save_error_message = error_message(err)
			throw new Error(save_error_message, { cause: err })
		} finally {
			saving = false
		}
	}

	const on_submit = (event: SubmitEvent) => {
		event.preventDefault()
		void save()
	}

	return {
		get error_message() { return save_error_message },
		get saving() { return saving },
		save,
		save_if_appropriate: async () => {
			if (!form.needs_to_be_saved) {
				return
			}
			return save()
		},
		on_submit,
	}
}

export type FormSaver = ReturnType<typeof form_saver>

export default form_saver
