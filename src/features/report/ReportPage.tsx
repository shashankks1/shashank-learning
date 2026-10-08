import type { YearReview } from '../../types';
import { curriculum, getMasteryTest } from '../../curriculum';
import { Button, Card, Meter, TextArea } from '../../components/ui';
import { capabilityMap, MATURITY_LABELS } from '../../lib/capability';
import { CAREER_STAGES, careerEvidence } from '../../lib/career';
import { totalMinutes } from '../../lib/activity';
import { dateOf, formatDateLong, formatMinutes, today } from '../../lib/dates';
import { formatINR } from '../../lib/format';
import { OPPORTUNITY_STATUS_LABELS, PORTFOLIO_STATUS_LABELS } from '../../lib/labels';
import { isMasteryPassed, masteryProgress } from '../../lib/mastery';
import { milestoneStates } from '../../lib/milestones';
import { completedWeeks, conceptsStudied, weekProgress } from '../../lib/progress';
import { useStore } from '../../store/store';

const NARRATIVE: { key: keyof YearReview; label: string; hint: string }[] = [
  { key: 'canBuild', label: 'What can I build now?', hint: 'Concretely, without help. Compare it with a year ago.' },
  { key: 'canExplain', label: 'What can I explain?', hint: 'Concepts you could teach.' },
  { key: 'failures', label: 'Biggest failures', hint: 'What broke, what you abandoned, what you got wrong.' },
  { key: 'breakthroughs', label: 'Biggest breakthroughs', hint: 'The moments something clicked.' },
  { key: 'deepen', label: 'Skills to deepen', hint: 'Where the evidence shows pull.' },
  { key: 'abandon', label: 'Skills to abandon', hint: 'What you’ll consciously stop investing in.' },
  { key: 'learnNext', label: 'What should I learn next?', hint: '' },
  { key: 'earningChange', label: 'Has my earning power changed?', hint: 'Honestly: income, offers, rates, options.' },
  { key: 'thesis', label: 'Year 2 thesis', hint: 'What you’ll bet on, why the evidence supports it, and how you’ll protect the floor.' },
];

export default function ReportPage() {
  const { data, update } = useStore();
  const hide = data.settings.hideFinancials;
  const map = capabilityMap(data);
  const shipped = data.builds.filter(build => build.status === 'completed' || build.status === 'published').sort((a, b) => a.date.localeCompare(b.date));
  const passed = curriculum.mastery.filter(test => isMasteryPassed(data, test.id));
  const evidence = careerEvidence(data);
  const investigated = data.opportunities.filter(item => item.status !== 'new');
  const milestones = milestoneStates(data).filter(state => state.achieved);
  const broke = data.buildLog.filter(entry => entry.broke.trim()).slice(-6).reverse();
  const income = [...data.career.incomeHistory].sort((a, b) => a.date.localeCompare(b.date));
  const concepts = conceptsStudied(data);
  const monthHours = curriculum.months.map(month => ({
    month,
    minutes: data.sessions.filter(session => curriculum.weeks.find(week => week.n === session.week)?.month === month.n).reduce((sum, session) => sum + session.minutes, 0),
  }));
  const maxMonth = Math.max(1, ...monthHours.map(item => item.minutes));
  const setReview = (key: keyof YearReview) => (value: string) => update(current => ({ ...current, yearReview: { ...current.yearReview, [key]: value } }));

  return (
    <article className="report">
      <header className="report__cover">
        <p className="eyebrow">Level 1 · Product-Minded AI Builder</p>
        <h1>Year 1 Capability Report</h1>
        <p className="lede">Generated {formatDateLong(today())} from your own records: {completedWeeks(data)} of 52 weeks closed, plan started {formatDateLong(data.curriculum.startDate)}.</p>
        <div className="button-row no-print">
          <Button variant="primary" icon="download" onClick={() => window.print()}>Print / save as PDF</Button>
        </div>
      </header>

      <section className="report__stats" aria-label="Year in numbers">
        <div><span className="report__stat">{completedWeeks(data)}</span><span>weeks closed</span></div>
        <div><span className="report__stat">{formatMinutes(totalMinutes(data))}</span><span>invested</span></div>
        <div><span className="report__stat">{shipped.length}</span><span>projects shipped</span></div>
        <div><span className="report__stat">{passed.length}/{curriculum.mastery.length}</span><span>masteries passed</span></div>
        <div><span className="report__stat">{evidence.portfolio}/5</span><span>portfolio proofs</span></div>
        <div><span className="report__stat">{investigated.length}</span><span>problems investigated</span></div>
        <div><span className="report__stat">{concepts.done}</span><span>concepts studied</span></div>
      </section>

      <Card label="Technical capabilities" title="Capability map">
        <ul className="capability">
          {map.map(area => (
            <li key={area.id} className="capability__row">
              <span className="capability__label">{area.label}</span>
              <Meter value={area.level} max={5} label={area.label} />
              <span className="capability__level">{MATURITY_LABELS[area.level]}</span>
              <span className="capability__evidence">{area.evidence}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="report__two">
        <Card label="Projects shipped">
          {shipped.length === 0 ? <p className="card__note">None yet.</p> : (
            <ul className="report-list">
              {shipped.map(build => (
                <li key={build.id}>
                  <strong>{build.name}</strong> <span className="muted">· {build.technology.join(', ')}</span>
                  <span className="report-list__links mono">{[build.liveUrl, build.githubUrl].filter(Boolean).join('  ')}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card label="Masteries passed">
          {passed.length === 0 ? <p className="card__note">None yet.</p> : (
            <ul className="report-list">
              {passed.map(test => {
                const progress = masteryProgress(data, test.id);
                return <li key={test.id}><strong>{getMasteryTest(test.id)?.title}</strong> <span className="muted mono">· Week {test.week} · {progress.passedAt ? formatDateLong(progress.passedAt) : ''}</span></li>;
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="report__two">
        <Card label="Portfolio evidence">
          <ol className="report-list">
            {data.portfolio.map(slot => (
              <li key={slot.slot}>
                <strong>{curriculum.portfolioSlots[slot.slot - 1]?.theme}</strong>: {slot.project || '—'} <span className="muted">· {PORTFOLIO_STATUS_LABELS[slot.status]}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card label="Hours invested by month">
          <ul className="month-bars">
            {monthHours.map(item => (
              <li key={item.month.n}>
                <span className="mono">M{item.month.n}</span>
                <span className="month-bars__track"><span className="month-bars__fill" style={{ width: `${(item.minutes / maxMonth) * 100}%` }} /></span>
                <span className="mono">{formatMinutes(item.minutes)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="report__two">
        <Card label="Problems investigated">
          {investigated.length === 0 ? <p className="card__note">No opportunities beyond “new” yet.</p> : (
            <ul className="report-list">
              {investigated.map(item => (
                <li key={item.id}><strong>{item.title || 'Untitled observation'}</strong> <span className="muted">· {OPPORTUNITY_STATUS_LABELS[item.status]} · {item.evidence.length} evidence</span></li>
              ))}
            </ul>
          )}
        </Card>
        <Card label="Career progress & income trajectory">
          <p>Stage {data.career.stage} of 9: <strong>{CAREER_STAGES[data.career.stage - 1].title}</strong></p>
          <p className="muted">{data.career.experiments.length} experiments · {evidence.applications} applications · {evidence.interviews} interviews · {evidence.freelance} freelance wins · {evidence.offers} offers</p>
          {hide ? <p className="muted">Income hidden.</p> : income.length > 0 && (
            <p className="mono">{income.map(record => `${formatINR(record.amount)} (${dateOf(record.date)})`).join(' → ')}</p>
          )}
        </Card>
      </div>

      <div className="report__two">
        <Card label="Milestones reached">
          {milestones.length === 0 ? <p className="card__note">None yet.</p> : (
            <ul className="report-list">{milestones.map(state => <li key={state.definition.id}><strong>{state.definition.title}</strong> <span className="muted">· {state.evidence}</span></li>)}</ul>
          )}
        </Card>
        <Card label="What broke (from the Build Log)">
          {broke.length === 0 ? <p className="card__note">Nothing logged as broken. Either very lucky or not logging.</p> : (
            <ul className="report-list">{broke.map(entry => <li key={entry.id}><strong>{entry.broke}</strong>{entry.learned && <span className="muted"> · learned: {entry.learned}</span>}</li>)}</ul>
          )}
        </Card>
      </div>

      <Card label="Reflection" title="In your own words">
        <p className="card__note no-print">These fields save automatically and print with the report. Write them in Week 52, or any time you want to see the shape of your year.</p>
        <div className="report__narrative">
          {NARRATIVE.map(item => (
            <TextArea key={item.key} label={item.label} hint={item.hint || undefined} value={data.yearReview[item.key]} onChange={setReview(item.key)} rows={3} />
          ))}
        </div>
      </Card>

      <p className="muted small">Weekly reviews written: {curriculum.weeks.filter(week => weekProgress(data, week.n).review).length}. Every number here comes from records you made; nothing is estimated.</p>
    </article>
  );
}
