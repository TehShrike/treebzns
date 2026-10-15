const error_message = (err: any): string => err?.body?.message ?? err?.message ?? `Something went wrong`

const form_saver = <VALUES, RESULT>({ form, send }: {
	form: { start_save: () => { values: VALUES, commit: (result: RESULT) => void, discard: () => void } }
	send: (values: VALUES) => Promise<RESULT>
}) => {
	let pending_save_promise = $state.raw<Promise<void> | null>(null)
	let saving = $state(false)

	const save = () => {
		const pending = form.start_save()
		const sent = send(pending.values)
			.catch((err: unknown) => {
				pending.discard()
				throw new Error(error_message(err), { cause: err })
			})
			.then(result => { pending.commit(result) })
		pending_save_promise = sent
		saving = true
		const settle = () => { saving = false }
		sent.then(settle, settle)
		return sent
	}

	const on_submit = (event: SubmitEvent) => {
		event.preventDefault()
		void save()
	}

	return {
		get pending_save_promise() { return pending_save_promise },
		get saving() { return saving },
		save,
		on_submit,
	}
}

export type FormSaver = ReturnType<typeof form_saver>

export default form_saver
