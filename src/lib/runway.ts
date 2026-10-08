import type { Financial } from '../types';

export interface RunwayResult {
  /** Essential expenses + debt payments: what a month costs if income stopped. */
  monthlyBurn: number;
  runwayMonths: number;
  monthlySurplus: number | null;
  gapToTarget: number;
  monthsToTarget: number | null;
  band: RunwayBand;
}

export type RunwayBand = 'floor' | 'cushion' | 'experiments' | 'bets';

export const RUNWAY_BANDS: Record<RunwayBand, { label: string; guidance: string }> = {
  floor: {
    label: 'Protect the floor',
    guidance: 'Under 3 months. Keep your income steady and build savings before taking on extra risk. Learn and build on the side.',
  },
  cushion: {
    label: 'Building a cushion',
    guidance: '3–6 months. Side experiments that don’t touch your income are reasonable. Keep growing the cushion.',
  },
  experiments: {
    label: 'Room for experiments',
    guidance: '6–12 months. You could consider bigger bets, but only with a written plan, a stop-loss date and a way back to income.',
  },
  bets: {
    label: 'Room for larger bets',
    guidance: '12+ months. A larger career or product bet becomes possible. Still plan for it taking twice as long as you expect.',
  },
};

/**
 * Runway = liquid savings ÷ (essential expenses + debt payments).
 * A planning aid, not financial advice. Returns null until the inputs needed are present.
 */
export function calculateRunway(financial: Financial): RunwayResult | null {
  const { liquidSavings, essentialExpenses, monthlyDebt, monthlyIncome, targetRunwayMonths } = financial;
  if (liquidSavings === null || essentialExpenses === null) return null;
  const monthlyBurn = essentialExpenses + (monthlyDebt ?? 0);
  if (monthlyBurn <= 0) return null;

  const runwayMonths = liquidSavings / monthlyBurn;
  const target = Math.max(0, targetRunwayMonths) * monthlyBurn;
  const gapToTarget = Math.max(0, target - liquidSavings);
  const monthlySurplus = monthlyIncome === null ? null : monthlyIncome - monthlyBurn;
  const monthsToTarget = gapToTarget === 0 ? 0 : monthlySurplus && monthlySurplus > 0 ? Math.ceil(gapToTarget / monthlySurplus) : null;

  const band: RunwayBand = runwayMonths < 3 ? 'floor' : runwayMonths < 6 ? 'cushion' : runwayMonths < 12 ? 'experiments' : 'bets';
  return { monthlyBurn, runwayMonths, monthlySurplus, gapToTarget, monthsToTarget, band };
}
