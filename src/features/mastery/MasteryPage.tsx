import { curriculum } from '../../curriculum';
import { MasteryStatePill } from '../../components/domain';
import { Card, Metric, PageHeader } from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { effectiveState, masteryProgress, masteryStats } from '../../lib/mastery';
import { currentWeekNumber } from '../../lib/progress';
import { useStore } from '../../store/store';
import { areaLabel } from '../../curriculum';

export default function MasteryPage() {
  const { data } = useStore();
  const current = currentWeekNumber(data);
  const stats = masteryStats(data, current);

  return (
    <>
      <PageHeader
        eyebrow="Mastery"
        title="Proofs of capability"
        lede="A test passes only with evidence, every success criterion met, a reflection in your own words, and honest answers about AI help. Passed tests come back for a no-notes re-check after 60 days."
      />
      <section className="metrics metrics--compact" aria-label="Mastery summary">
        <Metric label="Passed" value={`${stats.passed} / ${stats.total}`} />
        <Metric label="Opened so far" value={stats.opened} detail={`tests up to Week ${current}`} />
        <Metric label="Ready to test" value={stats.ready} />
        <Metric label="Due for re-check" value={stats.dueForReview} />
      </section>
      <div className="mastery-months">
        {curriculum.months.map(month => {
          const tests = curriculum.mastery.filter(test => curriculumMonthOf(test.week) === month.n);
          if (!tests.length) return null;
          return (
            <Card key={month.n} label={`Month ${month.n} · ${month.title}`}>
              <ul className="mastery-list">
                {tests.map(test => {
                  const progress = masteryProgress(data, test.id);
                  const state = effectiveState(progress);
                  return (
                    <li key={test.id}>
                      <a href={`#/mastery/${test.id}`} className={`mastery-row ${test.week > current ? 'is-future' : ''}`}>
                        <span className="mastery-row__week mono">W{String(test.week).padStart(2, '0')}</span>
                        <span className="mastery-row__main">
                          <span className="mastery-row__title">{test.title}</span>
                          <span className="mastery-row__challenge">{test.challenge}</span>
                        </span>
                        <span className="mastery-row__meta">
                          <MasteryStatePill state={state} />
                          <span className="mono-label">{areaLabel(test.area)}</span>
                          {progress.passedAt && <span className="mono muted">passed {formatDate(progress.passedAt)}</span>}
                          {!progress.passedAt && <span className="mono muted">{progress.criteria.length}/{test.criteria.length} criteria</span>}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function curriculumMonthOf(week: number): number {
  return curriculum.weeks.find(item => item.n === week)?.month ?? 0;
}
