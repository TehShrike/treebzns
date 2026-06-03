import make_state_router from 'abstract-state-router'
import { for_each } from '#shared/array.ts'
import make_svelte_state_renderer from 'svelte-state-renderer'

import context, { type Context } from './client_context.js'
import paths_and_states from './globbed_states.generated.ts'
import assert_child_states_are_below_parents from './assert_child_states_are_below_parents.ts'
import type { State } from './lib/state_type.ts'
import type { Component } from 'svelte'

assert_child_states_are_below_parents(paths_and_states as any)

type GoodEnoughState = State<string, any, Context, {}>

const add_state = ({
	Component,
	name,
	route,
	default_child: defaultChild,
	data,
	resolve: bare_resolve,
	querystring_parameters: querystringParameters,
	default_parameters: defaultParameters,
	param_validator,
	...rest
}: GoodEnoughState & { Component: Component }) => {
	const rest_keys = Object.keys(rest)
	if (rest_keys.length > 0) {
		console.error(`Found unexpected exports: "${ rest_keys.join(`, `) }" for state`, name)
	}

	const resolve = (param_validator && bare_resolve)
		? (data: Context, params: { [key: string]: string }) => {
			const validated_params = param_validator(params)
			return bare_resolve(data, validated_params)
		}
		: bare_resolve

	state_router.addState({
		template: Component,
		name,
		route,
		defaultChild,
		data: {
			...data,
			...context,
		},
		resolve,
		// activate: (context: ActivateArg<{ title?: string }, { title?: string }>) => {
		// 	update_title(context.content.title || context.data.title)
		// },
		querystringParameters,
		defaultParameters,
	})
}

const state_router = make_state_router(
	make_svelte_state_renderer(),
	document.getElementById(`app-target`)
)

for_each(paths_and_states as any, (globbed_state: { export: { asr_state: GoodEnoughState, default: Component } }) => {
	add_state({ ...globbed_state.export.asr_state, Component: globbed_state.export.default })
})

state_router.evaluateCurrentRoute(`login`)
