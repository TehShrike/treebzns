import type { StateParams } from './state_type.ts'

export default function redirect_resolve_to(redirect_to: { name: string, params?: StateParams }): never {
	throw { redirectTo: redirect_to }
}
