import { navigate } from '../../router';
import { useCreateBuild } from '../builds/useCreateBuild';
import { curriculum, getMasteryTest, getMonth, getWeek, TOTAL_WEEKS } from '../../curriculum';
import { ActivityHeatmap, HoursChart } from '../../components/charts';
import { BuildStatusPill, MasteryStatePill, dependencyRisk } from '../../components/domain';
import { Icon } from '../../components/Icon';
import { Button, Card, EmptyState, LinkButton, Meter, ProgressBar } from '../../components/ui';
import { capabilityMap, MATURITY_LABELS } from '../../lib/capability';
import { CAREER_STAGES, careerEvidence } from '../../lib/career';
import { dailyActivity, minutesForWeek, totalMinutes, weeklyMinutesSeries } from '../../lib/activity';
import { formatMinutes, formatRelative } from '../../lib/dates';
import { formatINRCompact, pad2, plural } from '../../lib/format';
import { currentMasteryTest, effectiveState, isMasteryPassed, masteryProgress, masteryStats } from '../../lib/mastery';
import { milestoneStates } from '../../lib/milestones';
import {
  SECTION_IDS,
  SECTION_LABELS,
  completedWeeks,
  conceptsStudied,
  nextItems,
  overallFraction,
  sectionDone,
  sectionState,
  sessionEstimate,
  weekProgress,
} from '../../lib/progress';
import { startWeek } from '../../store/actions';
import { useStore } from '../../store/store';
import { useUi } from '../shell/ui-context';

/* ---------- THIS WEEK ---------- */

export function MissionCard({ weekNumber }: { weekNumber: number }) {
  const { data, update } = useStore();
  const week = getWeek(weekNumber)!;
  const month = getMonth(week.month)!;
  const progress = weekProgress(data, weekNumber);
  const state = sectionState(data, week);
  const test = week.masteryId ? getMasteryTest(week.masteryId) : undefined;
  const logged = minutesForWeek(data, weekNumber);
  const allDone = SECTION_IDS.every(section => sectionDone(state, section));

  return (
    <section className="card mission" aria-labelledby="mission-title">
      <div className="mission__grid-bg" aria-hidden="true" />
      <div className="mission__top">
        <p className="mono-label">This week · Month {month.n} · {month.title}</p>
        <span className="mission__number" aria-hidden="true">{pad2(weekNumber)}</span>
      </div>
      <h2 id="mission-title" className="mission__title">{week.title}</h2>
      <dl className="mission__objectives">
        <div><dt>Learn</dt><dd>{week.objective}</dd></div>
        <div><dt>Build</dt><dd>{week.build.title}</dd></div>
        <div><dt>Prove</dt><dd>{test ? test.title : week.prove}</dd></div>
        <div><dt>Time</dt><dd className="mono">{week.hours[0]}–{week.hours[1]}h estimated · {formatMinutes(logged)} logged</dd></div>
      </dl>
      <ol className="section-track" aria-label="Week sections">
        {SECTION_IDS.map(section => {
          const done = sectionDone(state, section);
          const partial = section === 'learn' || section === 'practice' ? state[section] : null;
          return (
            <li key={section} className={done ? 'is-done' : ''}>
              <span className="section-track__label">{SECTION_LABELS[section]}</span>
              <span className="section-track__state">
                {done ? <Icon name="check" size={13} /> : partial ? `${partial.done}/${partial.total}` : '·'}
                <span className="visually-hidden">{done ? 'done' : 'not done'}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="button-row">
        {!progress.startedAt ? (
          <Button
            variant="primary"
            icon="play"
            onClick={() => {
              update(current => startWeek(current, weekNumber));
              navigate(`#/curriculum/week/${weekNumber}`);
            }}
          >
            Start week
          </Button>
        ) : allDone ? (
          <LinkButton href={`#/curriculum/week/${weekNumber}?review`} variant="primary" icon="check">Close week with a review</LinkButton>
        ) : (
          <LinkButton href={`#/curriculum/week/${weekNumber}`} variant="primary" icon="chevronRight">Continue week</LinkButton>
        )}
        <LinkButton href="#/curriculum" variant="ghost">Today’s session</LinkButton>
      </div>
    </section>
  );
}

export function TodayCard({ weekNumber }: { weekNumber: number }) {
  const { data } = useStore();
  const ui = useUi();
  const week = getWeek(weekNumber)!;
  const items = nextItems(data, weekNumber, 3);
  return (
    <Card label="Today’s focus" className="today-card">
      {items.length === 0 ? (
        <EmptyState title="Everything for this week is done.">Close the week with a review, then the next one opens.</EmptyState>
      ) : (
        <>
          <p className="today-card__focus">{items[0].text}</p>
          {items.length > 1 && (
            <ul className="today-card__next">
              {items.slice(1).map(item => (
                <li key={item.key}><span className="mono-label">Then</span> {item.text}</li>
              ))}
            </ul>
          )}
          <p className="today-card__build"><span className="mono-label">Build</span> {week.build.title}</p>
          <p className="today-card__estimate mono">Estimated session: {sessionEstimate(week)}</p>
        </>
      )}
      <div className="button-row">
        <Button variant="primary" icon="play" onClick={() => ui.openStartSession({ week: weekNumber })}>Start session</Button>
        <LinkButton href={`#/curriculum/week/${weekNumber}`} variant="ghost">Open week</LinkButton>
      </div>
    </Card>
  );
}

/* ---------- The five questions: building + proving + evidence ---------- */

export function CurrentBuildCard({ weekNumber }: { weekNumber: number }) {
  const { data } = useStore();
  const createBuild = useCreateBuild();
  const linkedId = weekProgress(data, weekNumber).buildId;
  const build =
    data.builds.find(item => item.id === linkedId) ??
    [...data.builds].filter(item => item.status === 'building' || item.status === 'blocked').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return (
    <Card label="What am I building?">
      {build ? (
        <a className="mini-record" href={`#/builds/${build.id}`}>
          <span className="mini-record__title">{build.name}</span>
          <span className="mini-record__meta"><BuildStatusPill status={build.status} /> {build.technology.slice(0, 3).join(' · ')}</span>
          {build.objective && <span className="mini-record__body">{build.objective}</span>}
        </a>
      ) : (
        <EmptyState title="No active build." action={<Button size="sm" icon="plus" onClick={() => createBuild({ week: weekNumber })}>New build</Button>}>
          Every learning area ends in something you build.
        </EmptyState>
      )}
    </Card>
  );
}

export function CurrentMasteryCard({ weekNumber }: { weekNumber: number }) {
  const { data } = useStore();
  const test = currentMasteryTest(data, weekNumber);
  if (!test) {
    return <Card label="What capability am I proving?"><EmptyState title="Every mastery test passed.">Remarkable. Time for the Year 1 report.</EmptyState></Card>;
  }
  const progress = masteryProgress(data, test.id);
  const state = effectiveState(progress);
  return (
    <Card label="What capability am I proving?">
      <a className="mini-record" href={`#/mastery/${test.id}`}>
        <span className="mini-record__title">{test.title}</span>
        <span className="mini-record__meta"><MasteryStatePill state={state} /> Week {test.week}</span>
        <span className="mini-record__body">{progress.criteria.length}/{test.criteria.length} success criteria met</span>
      </a>
    </Card>
  );
}

export function EvidenceCard() {
  const { data } = useStore();
  const evidence = careerEvidence(data);
  const passed = curriculum.mastery.filter(test => isMasteryPassed(data, test.id)).length;
  const rows = [
    { label: 'completed builds', value: evidence.projects, href: '#/builds' },
    { label: 'GitHub repositories', value: evidence.github, href: '#/builds' },
    { label: 'published portfolio proofs', value: evidence.portfolio, href: '#/portfolio' },
    { label: 'mastery tests passed', value: passed, href: '#/mastery' },
    { label: 'opportunity observations', value: data.opportunities.filter(item => item.status !== 'archived').length, href: '#/lab' },
    { label: 'build-log entries', value: data.buildLog.length, href: '#/log' },
  ];
  return (
    <Card label="What evidence am I accumulating?">
      <ul className="evidence-list">
        {rows.map(row => (
          <li key={row.label}>
            <a href={row.href}><span className="evidence-list__value">{row.value}</span> {row.label}</a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------- Progress model: separate tracks, never one fake score ---------- */

export function ProgressModelCard({ weekNumber }: { weekNumber: number }) {
  const { data } = useStore();
  const concepts = conceptsStudied(data);
  const mastery = masteryStats(data, weekNumber);
  const builds = data.builds.filter(build => build.status === 'completed' || build.status === 'published').length;
  const portfolio = data.portfolio.filter(slot => slot.status === 'published').length;
  const investigated = data.opportunities.filter(item => item.status !== 'new' && item.status !== 'archived').length;
  const tracks = [
    { label: 'Curriculum', detail: `${completedWeeks(data)} of ${TOTAL_WEEKS} weeks closed`, value: completedWeeks(data) / TOTAL_WEEKS },
    { label: 'Learning', detail: `${concepts.done} of ${concepts.total} concepts studied`, value: concepts.done / concepts.total },
    { label: 'Mastery', detail: `${mastery.passed} of ${mastery.total} tests passed`, value: mastery.passed / mastery.total },
    { label: 'Building', detail: `${builds} build${builds === 1 ? '' : 's'} shipped or completed`, value: Math.min(1, builds / 12) },
    { label: 'Portfolio', detail: `${portfolio} of 5 proofs published`, value: portfolio / 5 },
    { label: 'Career', detail: `${plural(data.career.experiments.length, 'experiment')} · stage ${data.career.stage} of 9`, value: (data.career.stage - 1) / 8 },
    { label: 'Founder', detail: `${investigated} of ${data.opportunities.length} problems under investigation`, value: Math.min(1, investigated / 5) },
  ];
  return (
    <Card label="Progress model" title="Seven separate tracks">
      <p className="card__note">Kept apart on purpose. Collapsing them into one score would hide what’s actually moving.</p>
      <ul className="tracks">
        {tracks.map(track => (
          <li key={track.label}>
            <div className="tracks__head">
              <span className="tracks__label">{track.label}</span>
              <span className="tracks__detail">{track.detail}</span>
            </div>
            <ProgressBar value={track.value} label={`${track.label}: ${track.detail}`} tone="ink" />
          </li>
        ))}
      </ul>
      <p className="card__note mono">Hours invested: {formatMinutes(totalMinutes(data))} · Overall curriculum work: {Math.round(overallFraction(data) * 100)}%</p>
    </Card>
  );
}

export function CapabilityMapCard() {
  const { data } = useStore();
  const map = capabilityMap(data);
  return (
    <Card label="Capability map" title="What am I becoming good at?">
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
      <p className="card__note">Levels: learning, practicing, building, proven (mastery passed), shipped (live). Each level needs real evidence.</p>
    </Card>
  );
}

export function CareerTrajectoryCard() {
  const { data } = useStore();
  const stage = data.career.stage;
  const current = CAREER_STAGES[stage - 1];
  const next = CAREER_STAGES[Math.min(stage, CAREER_STAGES.length - 1)];
  const longTerm = data.career.target.income ? `${formatINRCompact(data.career.target.income)}/month` : CAREER_STAGES[3].title;
  return (
    <Card label="Career trajectory" actions={<LinkButton href="#/career" size="sm" variant="ghost">Career</LinkButton>}>
      <ol className="trajectory">
        <li><span className="mono-label">Now</span><strong>{current.title}</strong></li>
        <li aria-hidden="true" className="trajectory__arrow"><Icon name="chevronRight" /></li>
        <li><span className="mono-label">Next</span><strong>{next.n === stage ? 'Path complete' : next.title}</strong></li>
        <li aria-hidden="true" className="trajectory__arrow"><Icon name="chevronRight" /></li>
        <li><span className="mono-label">Long-term target</span><strong>{longTerm}</strong></li>
      </ol>
      <p className="card__note">Directional targets, not promises. What makes them more likely is evidence: shipped builds, passed tests, real conversations.</p>
    </Card>
  );
}

export function HoursCard() {
  const { data } = useStore();
  return (
    <Card label="Hours per week" title="Time invested">
      <HoursChart series={weeklyMinutesSeries(data, 8)} targetMin={data.settings.weeklyTargetMin} targetMax={data.settings.weeklyTargetMax} />
    </Card>
  );
}

export function ActivityCard() {
  const { data } = useStore();
  const recent = [...data.activities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);
  return (
    <Card label="Recent activity" title="The record">
      <ActivityHeatmap cells={dailyActivity(data, 18)} />
      {recent.length === 0 ? (
        <p className="card__note">Nothing logged yet. Check off a concept or start a session.</p>
      ) : (
        <ul className="activity-list">
          {recent.map(activity => (
            <li key={activity.id}>
              <span className="activity-list__when mono">{formatRelative(activity.at)}</span>
              <span className="activity-list__what">{activity.label}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function MilestonesCard() {
  const { data } = useStore();
  const states = milestoneStates(data);
  const achieved = states.filter(state => state.achieved);
  const upcoming = states.filter(state => !state.achieved).slice(0, 3);
  return (
    <Card label="Milestones" title={`${achieved.length} of ${states.length} reached`} actions={<LinkButton href="#/report" size="sm" variant="ghost">Report</LinkButton>}>
      <ul className="milestones">
        {achieved.map(state => (
          <li key={state.definition.id} className="is-achieved">
            <Icon name="check" size={14} /> <span>{state.definition.title}</span>
            <span className="milestones__evidence">{state.evidence}</span>
          </li>
        ))}
        {upcoming.map(state => (
          <li key={state.definition.id}>
            <span className="milestones__dot" aria-hidden="true" /> <span>{state.definition.title}</span>
            <span className="milestones__evidence">{state.definition.bar}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AgencyCard() {
  const { data } = useStore();
  const items = [
    ...data.builds.map(build => ({ id: build.id, title: build.name, ai: build.ai, href: `#/builds/${build.id}` })),
    ...data.buildLog.map(entry => ({ id: entry.id, title: entry.tried || 'Log entry', ai: entry.ai, href: `#/log/${entry.id}` })),
  ].filter(item => item.ai.used);
  const atRisk = items.filter(item => ['medium', 'high'].includes(dependencyRisk(item.ai)));
  return (
    <Card label="AI leverage · agency check">
      <p className="agency__summary">
        <strong>{items.length}</strong> AI-assisted {items.length === 1 ? 'item' : 'items'} ·{' '}
        <strong>{atRisk.length}</strong> you can’t yet fully explain or modify
      </p>
      {atRisk.length > 0 ? (
        <ul className="plain-list">
          {atRisk.slice(0, 3).map(item => (
            <li key={item.id}><a href={item.href}>{item.title}</a> · <span className="muted">{dependencyRisk(item.ai)} dependency</span></li>
          ))}
        </ul>
      ) : (
        <p className="card__note">AI should increase your leverage without decreasing your agency. So far it has.</p>
      )}
    </Card>
  );
}
