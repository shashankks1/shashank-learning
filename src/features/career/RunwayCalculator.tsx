import type { Financial } from '../../types';
import { Card, NumberField } from '../../components/ui';
import { formatINR } from '../../lib/format';
import { calculateRunway, RUNWAY_BANDS } from '../../lib/runway';
import { nowISO } from '../../lib/dates';
import { useStore } from '../../store/store';

/** A private planning aid: when could a bigger bet be safe? Not financial advice. */
export function RunwayCalculator() {
  const { data, update } = useStore();
  const financial = data.financial;
  const hide = data.settings.hideFinancials;
  const result = calculateRunway(financial);
  const set = (change: Partial<Financial>) => update(current => ({ ...current, financial: { ...current.financial, ...change, updatedAt: nowISO() } }));

  return (
    <Card label="Financial runway · private" title="How long could you go without income?" className="runway">
      <p className="card__note">
        Stored only in this browser. Include it in backups or not (Settings). <strong>A planning tool, not financial advice.</strong>
      </p>
      {hide ? (
        <p className="field-static">Amounts are hidden. Use “Show amounts” at the top of the page to edit.</p>
      ) : (
        <div className="form-grid form-grid--3">
          <NumberField label="Monthly income (take-home)" prefix="₹" value={financial.monthlyIncome} onChange={monthlyIncome => set({ monthlyIncome })} />
          <NumberField label="Essential monthly expenses" prefix="₹" value={financial.essentialExpenses} onChange={essentialExpenses => set({ essentialExpenses })} hint="Rent, food, utilities, insurance, family support." />
          <NumberField label="Monthly debt obligations" prefix="₹" value={financial.monthlyDebt} onChange={monthlyDebt => set({ monthlyDebt })} hint="EMIs and minimum payments." />
          <NumberField label="Liquid savings" prefix="₹" value={financial.liquidSavings} onChange={liquidSavings => set({ liquidSavings })} hint="Cash you could use within a week. Not retirement funds." />
          <NumberField label="Target runway" suffix="months" value={financial.targetRunwayMonths} onChange={value => { if (value !== null && value >= 1) set({ targetRunwayMonths: value }); }} min={1} />
        </div>
      )}

      {result ? (
        <div className={`runway__result band-${result.band}`}>
          <div className="runway__headline">
            <span className="runway__months">{result.runwayMonths.toFixed(1)}</span>
            <span className="runway__unit">months of runway</span>
          </div>
          <p className="runway__formula mono">
            {hide ? 'Savings ÷ (essentials + debt payments)' : `${formatINR(financial.liquidSavings)} ÷ ${formatINR(result.monthlyBurn)} per month`}
          </p>
          <p className="runway__band"><strong>{RUNWAY_BANDS[result.band].label}.</strong> {RUNWAY_BANDS[result.band].guidance}</p>
          <ul className="runway__facts">
            <li>Target: {financial.targetRunwayMonths} months{result.gapToTarget > 0 && !hide ? `, ${formatINR(result.gapToTarget)} to go` : result.gapToTarget === 0 ? ', reached' : ''}</li>
            {result.monthlySurplus !== null && !hide && (
              <li>Monthly surplus at current income: {formatINR(result.monthlySurplus)}{result.monthsToTarget !== null && result.monthsToTarget > 0 ? `, about ${result.monthsToTarget} months to target if saved in full` : ''}</li>
            )}
            {result.monthlySurplus !== null && result.monthlySurplus <= 0 && <li className="warn-text">Expenses meet or exceed income. Stabilising that comes before any bet.</li>}
          </ul>
        </div>
      ) : (
        <p className="card__note">Enter essential expenses and liquid savings to see your runway.</p>
      )}
    </Card>
  );
}
