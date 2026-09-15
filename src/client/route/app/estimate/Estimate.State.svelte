<script module lang="ts">
	import { state_type } from '#client/lib/client_type.ts'
	import { validate_estimate_params } from './estimate_params.ts'

	export const asr_state = state_type({
		name: `app.estimate`,
		route: `/estimate/:project_id`,
		default_child: `intro`,
		param_validator: validate_estimate_params,
	})
</script>

<uiView></uiView>

<style>
	uiView {
		display: contents;
	}
</style>
