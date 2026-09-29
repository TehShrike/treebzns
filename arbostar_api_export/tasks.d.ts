export type ArbostarApiTaskCategory = {
	category_id: number
	category_name: string
}

export type ArbostarApiTask = {
	task_id: number
	/** YYYY-MM-DD */
	task_date: string
	task_start: string
	task_end: string
	task_status: string
	category: ArbostarApiTaskCategory
	user_id: number
}

declare const tasks: ArbostarApiTask[]
export default tasks
