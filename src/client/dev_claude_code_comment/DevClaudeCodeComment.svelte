<script lang="ts">
	let target_element: HTMLElement | null = $state(null)
	let comment_text = $state(``)
	let popup_x = $state(0)
	let popup_y = $state(0)

	const close = () => {
		target_element = null
		comment_text = ``
	}

	const on_click_capture = (event: MouseEvent) => {
		if (!event.altKey) {
			return
		}

		const element = event.target
		if (!(element instanceof HTMLElement) || element.closest(`.dev-claude-code-comment-popup`)) {
			return
		}

		event.preventDefault()
		event.stopPropagation()

		target_element = element
		comment_text = element.dataset.claudeComment ?? ``
		popup_x = Math.min(event.clientX, window.innerWidth - 340)
		popup_y = Math.min(event.clientY, window.innerHeight - 150)
	}

	const find_claude_comment_node = (element: HTMLElement) => {
		const previous = element.previousSibling
		return previous instanceof Comment && previous.data.startsWith(` claude:`) ? previous : null
	}

	const save = () => {
		if (!target_element) {
			return
		}

		const text = comment_text.trim()
		const existing_comment_node = find_claude_comment_node(target_element)

		if (text) {
			target_element.dataset.claudeComment = text
			const comment_data = ` claude: ${ text } `
			if (existing_comment_node) {
				existing_comment_node.data = comment_data
			} else {
				target_element.before(document.createComment(comment_data))
			}
		} else {
			delete target_element.dataset.claudeComment
			existing_comment_node?.remove()
		}

		close()
	}

	const on_textarea_keydown = (event: KeyboardEvent) => {
		if (event.key === `Enter` && !event.shiftKey) {
			event.preventDefault()
			save()
		} else if (event.key === `Escape`) {
			close()
		}
	}

	const focus = (element: HTMLTextAreaElement) => {
		element.focus()
	}
</script>

<svelte:window onclickcapture={on_click_capture} />

{#if target_element}
	<div class="dev-claude-code-comment-popup" style="left: {popup_x}px; top: {popup_y}px">
		<textarea
			{@attach focus}
			bind:value={comment_text}
			onkeydown={on_textarea_keydown}
			placeholder="Comment for Claude"
		></textarea>
		<div class="hint">enter saves, esc cancels, saving empty removes</div>
	</div>
{/if}

<style>
	.dev-claude-code-comment-popup {
		position: fixed;
		z-index: 99999;
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 320px;
		padding: 8px;
		background: white;
		border: 2px solid darkorange;
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
	}

	textarea {
		width: 100%;
		min-height: 60px;
		resize: vertical;
		font: inherit;
		box-sizing: border-box;
	}

	.hint {
		font-size: 11px;
		color: #666;
	}

	:global([data-claude-comment]) {
		outline: 2px dashed darkorange;
		outline-offset: 2px;
	}
</style>
