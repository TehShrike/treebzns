import { round, withDefaultRoundingStrategy } from 'financial-number'
import type { FinancialNumber } from 'financial-number'
export type { FinancialNumber }

const fnum = withDefaultRoundingStrategy(round)

export default fnum
