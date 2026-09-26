import { create_s3_client } from './s3_client.ts'

export type SpacesEnv = {
	SPACES_REGION: string
	SPACES_BUCKET: string
	SPACES_ACCESS_KEY_ID: string
	SPACES_SECRET_ACCESS_KEY: string
}

export const create_spaces_client = (env: SpacesEnv) => create_s3_client({
	endpoint: `https://${env.SPACES_BUCKET}.${env.SPACES_REGION}.digitaloceanspaces.com`,
	region: env.SPACES_REGION,
	access_key_id: env.SPACES_ACCESS_KEY_ID,
	secret_access_key: env.SPACES_SECRET_ACCESS_KEY,
})
