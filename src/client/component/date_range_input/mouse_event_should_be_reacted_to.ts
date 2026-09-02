export default (event: MouseEvent) => !event.defaultPrevented
	&& event.button === 0
	&& !event.metaKey
	&& !event.altKey
	&& !event.ctrlKey
	&& !event.shiftKey
