export type ArbostarApiBrandAddress = {
	street: string
	region: string
	city: string
	state: string
	zip: string
	country: string
	coordinates: { lat: string; lng: string }
}

export type ArbostarApiBrand = {
	id: number
	name: string
	phone: string
	email: string
	url: string
	main_address: ArbostarApiBrandAddress
	alternative_address?: ArbostarApiBrandAddress
	is_default: boolean
}

declare const brands: ArbostarApiBrand[]
export default brands
