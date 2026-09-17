import { ResponseError } from './response_helpers.ts'

export default async (request: Request): Promise<FormData> => {
	try {
		return await request.formData()
	} catch {
		throw new ResponseError({ message: `Request body must be multipart/form-data`, status: 400 })
	}
}
