import assert from '#shared/assert.ts'

export type UndoStack<T> = {
	readonly done: readonly T[]
	readonly undone: readonly T[]
}

export const empty = <T>(): UndoStack<T> => ({ done: [], undone: [] })

export const can_undo = (stack: UndoStack<unknown>) => stack.done.length > 0

export const can_redo = (stack: UndoStack<unknown>) => stack.undone.length > 0

export const push = <T>(stack: UndoStack<T>, entry: T): UndoStack<T> => ({
	done: [...stack.done, entry],
	undone: [],
})

export const undo = <T>(stack: UndoStack<T>): UndoStack<T> => {
	assert(can_undo(stack), `the undo stack has an entry to undo`)

	return {
		done: stack.done.slice(0, -1),
		undone: [...stack.undone, stack.done[stack.done.length - 1] as T],
	}
}

export const redo = <T>(stack: UndoStack<T>): UndoStack<T> => {
	assert(can_redo(stack), `the undo stack has an undone entry to redo`)

	return {
		done: [...stack.done, stack.undone[stack.undone.length - 1] as T],
		undone: stack.undone.slice(0, -1),
	}
}
