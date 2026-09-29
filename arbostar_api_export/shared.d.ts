export type ArbostarApiStatus = {
	id: number
	name: string
}

export type ArbostarApiPerson = {
	id: number
	firstname: string
	lastname: string
}

export type ArbostarApiColoredPerson = ArbostarApiPerson & {
	color: string
}

export type ArbostarApiAddress = {
	address: string
	city: string
	state: string
	zip: string
	country: string
	lat: number
	lon: number
}

export type ArbostarApiContact = {
	id: number
	client_id: number
	title: string | null
	name: string
	phone: string | null
	email: string
	main: boolean
}

export type ArbostarApiClientSummary = {
	id: number
	name: string
	/** '1' = residential, '2' = commercial */
	type: string
	address: string
	city: string
	state: string
	zip: string
	country: string
	lon: number | string
	lat: number | string
	source: string
	integration_id: string
	/** YYYY-MM-DD */
	created_at: string
	contacts: ArbostarApiContact[]
}

export type ArbostarApiCategory = {
	id: number
	name: string
	active: boolean
	integration_id: string
	parent_category: string
}

export type ArbostarApiCatalogItem = {
	id: number
	name: string
	description: string | null
	active: boolean
	cost: number | null
	is_product: boolean
	is_bundle: boolean
	non_taxable: boolean
	integration_id: string | null
	category: ArbostarApiCategory | null
	class: string
	accounting_code: string
	account: {
		name: string | false
		code: string | false
		integration_id: string | false
	}
}

export type ArbostarApiLineItem = {
	id: number
	invoice_id: number | null
	item: ArbostarApiCatalogItem
	description: string | null
	price: number
	cost: number | null
	qty: number
	non_taxable: boolean
	/** 0 New, 1 Declined, 2 Completed */
	status: ArbostarApiStatus
	class: string
	/** YYYY-MM-DD */
	date: string | null
	integration_id: string
	accounting_code: string
}

export type ArbostarApiTax = {
	name: string
	/** Percent, e.g. '5.5000' */
	value: string
}

export type ArbostarApiEntityReference = {
	id: number
	number: string
}
