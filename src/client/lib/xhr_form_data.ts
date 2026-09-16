const error_message_from_body = (xhr: XMLHttpRequest): string => {
	if (xhr.getResponseHeader(`Content-Type`) === `application/json`) return JSON.parse(xhr.responseText).error
	return xhr.statusText || `Upload failed with status ${xhr.status}`
}

export const xhr_form_data = ({ url, form_data, method = `PUT`, on_progress, on_sent }: {
	url: string
	form_data: FormData
	method?: string
	on_progress?: (progress: { sent: number, total: number }) => void
	on_sent?: () => void
}): Promise<void> => new Promise((resolve, reject) => {
	const xhr = new XMLHttpRequest()
	xhr.open(method, url)
	xhr.upload.onprogress = event => {
		if (event.lengthComputable) on_progress?.({ sent: event.loaded, total: event.total })
	}
	xhr.upload.onload = () => on_sent?.()
	xhr.onload = () => {
		if (xhr.status >= 200 && xhr.status < 300) {
			resolve()
		} else {
			reject(new Error(error_message_from_body(xhr)))
		}
	}
	xhr.onerror = () => reject(new Error(`The upload could not reach the server`))
	xhr.onabort = () => reject(new Error(`The upload was cancelled`))
	xhr.send(form_data)
})
