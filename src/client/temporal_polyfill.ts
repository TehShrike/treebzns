import { Temporal, toTemporalInstant } from '@js-temporal/polyfill'

Object.assign(globalThis, { Temporal })
Object.assign(Date.prototype, { toTemporalInstant })
