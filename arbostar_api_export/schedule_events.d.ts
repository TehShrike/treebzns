export type ArbostarApiScheduleEvent = {
	id: number
	planned_date: string | null
	/** Unix seconds */
	event_start: number
	/** Unix seconds */
	event_end: number
	zip_code: string
	address: string
	crew: {
		crew_id: number
		crew_name: string
		leader: string
	}
	/** The field report, once the crew files one. */
	jobs: {
		ev_id: number
		ev_event_id: number
		ev_team_id: number
		ev_start_time: string
		ev_end_time: string | null
		ev_start_work: string | null
		ev_end_work: string | null
		ev_start_travel: string
		ev_travel_time: number | null
		ev_on_site_time: number | null
		ev_date: string
		ev_description: string | null
		ev_report_confirmed: boolean
		ev_date_view: string
		total_report_time: number
	} | null
	workorder_number: string
	workorder_status: {
		status: string
		id: number
	}
	lead_source: string | null
	client: string
	estimator: string
	totals_estimate: number
	event_price: number
	/** id is the line item id */
	services: {
		id: number
		service_id: number
		service_name: string
		service_price: number
		service_class_id: number | null
		service_class_name: string | null
	}[]
}

declare const schedule_events: ArbostarApiScheduleEvent[]
export default schedule_events
