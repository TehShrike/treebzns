// Usage to always autofocus:     <input type="text" {@attach autofocus_attachment(true)} />
// Usage to optionally autofocus: <input type="text" {@attach autofocus_attachment(my_boolean_variable)} />

import type { Attachment } from 'svelte/attachments'

export default (should_autofocus: boolean): Attachment<HTMLElement> => node => {
	if (!should_autofocus) {
		return
	}

	const timeout = setTimeout(() => node.focus(), 0)

	return () => clearTimeout(timeout)
}
