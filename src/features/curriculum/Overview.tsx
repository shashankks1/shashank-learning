import { curriculum, getMasteryTest, getMonth, weeksInMonth } from '../../curriculum';
import { WeekStatusPill } from '../../components/domain';
import { Icon } from '../../components/Icon';
import { EmptyState, LinkButton, PageHeader, Pill, ProgressBar, Segmented } from '../../components/ui';
import { minutesForWeek } from '../../lib/activity';
import { formatDate, formatMinutes } from '../../lib/dates';
import { WEEK_STATUS_LABELS } from '../../lib/labels';
import {
  SECTION_IDS,
  currentWeekNumber,
  isMasteryPending,
  matchesFilter,
  plannedStart,
  sectionDone,
  sectionState,
  weekStatus,
  type CurriculumFilter,
} from '../../lib/progress';
import { useStore } from '../../store/store';
import type { AppData } from '../../types';

const FILTERS: { value: CurriculumFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'not-started', label: WEEK_STATUS_LABELS['not-started'] },
  { value: 'in-progress', label: WEEK_STATUS_LABELS['in-progress'] },
  { value: 'complete', label: WEEK_STATUS_LABELS.complete },
  { value: 'blocked', label: WEEK_STATUS_LABELS.blocked },
  { value: 'mastery-pending', label: 'Mastery pending' },
];

function FilterBar({ data, filter, onFilter }: { data: AppData; filter: CurriculumFilter; onFilter: (filter: CurriculumFilter) => void }) {
  const options = FILTERS.map(option => ({
    ...option,
    count: curriculum.weeks.filter(week => matchesFilter(data, week, option.value)).length,
  }));
  return <Segmented label="Filter weeks" hideLabel value={filter} options={options} onChange={onFilter} />;
}

export function YearView({ filter, onFilter }: { filter: CurriculumFilter; onFilter: (filter: CurriculumFilter) => void }) {
  const { data } = useStore();
  const current = currentWeekNumber(data);
  return (
    <>
      <PageHeader eyebrow="Curriculum · Year" title="52 weeks, 12 proofs of capability" lede="Every month ends in something built and a capability proven. Weeks that don’t match the filter are dimmed, not hidden, so the shape of the year stays visible." />
      <FilterBar data={data} filter={filter} onFilter={onFilter} />
      <ol className="year-grid">
        {curriculum.months.map(month => {
          const weeks = weeksInMonth(month.n);
          const closed = weeks.filter(week => weekStatus(data, week) === 'complete').length;
          const isCurrent = weeks.some(week => week.n === current);
          return (
            <li key={month.n} className={`month-card ${isCurrent ? 'is-current' : ''}`}>
              <a className="month-card__link" href={`#/curriculum/month/${month.n}`}>
                <span className="month-card__number mono">M{String(month.n).padStart(2, '0')}</span>
                <span className="month-card__title">{month.title}</span>
              </a>
              <p className="month-card__build"><span className="mono-label">Build</span> {month.build}</p>
              <ol className="week-chips" aria-label={`Weeks in month ${month.n}`}>
                {weeks.map(week => {
                  const status = weekStatus(data, week);
                  const match = matchesFilter(data, week, filter);
                  return (
                    <li key={week.n}>
                      <a
                        href={`#/curriculum/week/${week.n}`}
                        className={`week-chip status-${status} ${week.n === current ? 'is-current' : ''} ${match ? '' : 'is-dimmed'}`}
                        title={`Week ${week.n} · ${week.title} · ${WEEK_STATUS_LABELS[status]}`}
                      >
                        <span className="week-chip__n mono">{week.n}</span>
                        <span className="week-chip__title">{week.title}</span>
                        {isMasteryPending(data, week) && <span className="week-chip__flag" aria-label="mastery pending">◆</span>}
                      </a>
                    </li>
                  );
                })}
              </ol>
              <div className="month-card__foot">
                <ProgressBar value={closed / weeks.length} label={`Month ${month.n}: ${closed} of ${weeks.length} weeks closed`} tone="ink" />
                <span className="mono">{closed}/{weeks.length}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

export function MonthView({ month: monthNumber, filter, onFilter }: { month: number; filter: CurriculumFilter; onFilter: (filter: CurriculumFilter) => void }) {
  const { data } = useStore();
  const month = getMonth(monthNumber)!;
  const weeks = weeksInMonth(monthNumber);
  const visible = weeks.filter(week => matchesFilter(data, week, filter));
  const current = currentWeekNumber(data);
  const masteryWeek = weeks.find(week => week.masteryId);
  const test = masteryWeek?.masteryId ? getMasteryTest(masteryWeek.masteryId) : undefined;

  return (
    <>
      <PageHeader
        eyebrow={`Curriculum · Month ${month.n} of 12`}
        title={month.title}
        lede={month.theme}
        actions={
          <nav className="pager pager--compact" aria-label="Month navigation">
            {month.n > 1 && <LinkButton href={`#/curriculum/month/${month.n - 1}`} variant="ghost" icon="chevronLeft" size="sm">Month {month.n - 1}</LinkButton>}
            {month.n < 12 && <LinkButton href={`#/curriculum/month/${month.n + 1}`} variant="ghost" size="sm">Month {month.n + 1} <Icon name="chevronRight" size={15} /></LinkButton>}
          </nav>
        }
      />
      <div className="month-summary">
        <div><p className="mono-label">Month build</p><p>{month.build}</p></div>
        <div><p className="mono-label">Mastery</p><p>{test ? <a href={`#/mastery/${test.id}`}>{test.title}</a> : month.mastery}</p></div>
        <div><p className="mono-label">Checkpoint</p><p>{month.checkpoint}</p></div>
      </div>
      <FilterBar data={data} filter={filter} onFilter={onFilter} />
      {visible.length === 0 ? (
        <EmptyState title="No weeks in this month match the filter." />
      ) : (
        <ol className="week-rows">
          {visible.map(week => {
            const status = weekStatus(data, week);
            const state = sectionState(data, week);
            return (
              <li key={week.n}>
                <a className={`week-row ${week.n === current ? 'is-current' : ''}`} href={`#/curriculum/week/${week.n}`}>
                  <span className="week-row__n mono">W{String(week.n).padStart(2, '0')}</span>
                  <span className="week-row__main">
                    <span className="week-row__title">{week.title}</span>
                    <span className="week-row__objective">{week.objective}</span>
                    <span className="week-row__meta">
                      <span><span className="mono-label">Build</span> {week.build.title}</span>
                      <span className="mono">{formatDate(plannedStart(data, week.n))} · {formatMinutes(minutesForWeek(data, week.n))} logged</span>
                    </span>
                  </span>
                  <span className="week-row__status">
                    <WeekStatusPill status={status} />
                    {isMasteryPending(data, week) && <Pill tone="warn">Mastery pending</Pill>}
                    <span className="dots" aria-label={`${SECTION_IDS.filter(section => sectionDone(state, section)).length} of 6 sections done`}>
                      {SECTION_IDS.map(section => <span key={section} className={`dot ${sectionDone(state, section) ? 'is-on' : ''}`} />)}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
      {visible.length < weeks.length && <p className="muted">{weeks.length - visible.length} week(s) hidden by the filter.</p>}
    </>
  );
}
