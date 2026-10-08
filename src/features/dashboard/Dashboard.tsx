import { curriculum, getMonth, getWeek, TOTAL_WEEKS } from '../../curriculum';
import { Icon } from '../../components/Icon';
import { Button, Metric } from '../../components/ui';
import { currentStreak, minutesThisWeek } from '../../lib/activity';
import { formatMinutes, today } from '../../lib/dates';
import { pad2 } from '../../lib/format';
import { masteryStats } from '../../lib/mastery';
import { currentWeekNumber, isYearComplete, overallFraction, recoveryState, weeksBehind } from '../../lib/progress';
import { computeReminders, type Reminder } from '../../lib/reminders';
import { dismissReminder } from '../../store/actions';
import { useStore } from '../../store/store';
import { useTick } from '../../hooks';
import { navigate } from '../../router';
import { useUi } from '../shell/ui-context';
import { useSync } from '../../sync/SyncProvider';
import { RecoveryCard } from '../curriculum/Recovery';
import {
  ActivityCard,
  AgencyCard,
  CapabilityMapCard,
  CareerTrajectoryCard,
  CurrentBuildCard,
  CurrentMasteryCard,
  EvidenceCard,
  HoursCard,
  MilestonesCard,
  MissionCard,
  ProgressModelCard,
  TodayCard,
} from './cards';

export function Dashboard() {
  const { data } = useStore();
  useTick(60_000, Boolean(data.activeSession));
  const weekNumber = currentWeekNumber(data);
  const week = getWeek(weekNumber)!;
  const month = getMonth(week.month)!;
  const recovery = recoveryState(data);
  const behind = weeksBehind(data);
  const principle = curriculum.principles[Math.abs(hashDay(today())) % curriculum.principles.length];

  return (
    <div className="dashboard">
      <header className="page-header dashboard__header">
        <div className="page-header__text">
          <p className="eyebrow">Where am I? · Week {pad2(weekNumber)} / {TOTAL_WEEKS} · Month {month.n}: {month.title}</p>
          <h1>{isYearComplete(data) ? 'Year 1 complete.' : week.title}</h1>
          <p className="lede">{isYearComplete(data) ? 'Write the Year 1 Capability Report and decide the next bet.' : week.objective}</p>
        </div>
        <p className="principle principle--header" aria-label="Today’s principle">{principle}</p>
      </header>

      <Reminders />
      {(recovery.level !== 'none' || behind >= 2) && <RecoveryCard />}

      <MetricsStrip weekNumber={weekNumber} />

      <div className="dashboard__primary">
        <MissionCard weekNumber={weekNumber} />
        <TodayCard weekNumber={weekNumber} />
      </div>

      <div className="dashboard__questions">
        <CurrentBuildCard weekNumber={weekNumber} />
        <CurrentMasteryCard weekNumber={weekNumber} />
        <EvidenceCard />
      </div>

      <div className="dashboard__two">
        <CapabilityMapCard />
        <ProgressModelCard weekNumber={weekNumber} />
      </div>

      <div className="dashboard__three">
        <HoursCard />
        <CareerTrajectoryCard />
        <AgencyCard />
      </div>

      <div className="dashboard__two">
        <ActivityCard />
        <MilestonesCard />
      </div>
    </div>
  );
}

function hashDay(day: string): number {
  return [...day].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);
}

function MetricsStrip({ weekNumber }: { weekNumber: number }) {
  const { data } = useStore();
  const minutes = minutesThisWeek(data);
  const stats = masteryStats(data, weekNumber);
  const streak = currentStreak(data);
  const completedBuilds = data.builds.filter(build => build.status === 'completed' || build.status === 'published').length;
  const published = data.portfolio.filter(slot => slot.status === 'published').length;
  const openOpportunities = data.opportunities.filter(item => item.status !== 'archived').length;
  const { weeklyTargetMin, weeklyTargetMax } = data.settings;

  return (
    <section className="metrics" aria-label="Key metrics">
      <Metric label="Week" value={<>{pad2(weekNumber)}<span className="metric__of"> / {TOTAL_WEEKS}</span></>} />
      <Metric label="Overall" value={`${Math.round(overallFraction(data) * 100)}%`} detail="curriculum work done" />
      <Metric
        label="Hours this week"
        value={formatMinutes(minutes)}
        detail={`target ${weeklyTargetMin}–${weeklyTargetMax}h`}
      />
      <Metric label="Builds" value={data.builds.length} detail={`${completedBuilds} completed`} />
      <Metric
        label="Mastery"
        value={<>{stats.passed}<span className="metric__of"> / {Math.max(stats.opened, stats.passed)}</span></>}
        detail={`passed of opened · ${stats.total} in the year`}
      />
      <Metric label="Portfolio" value={<>{published}<span className="metric__of"> / 5</span></>} detail="proofs published" />
      <Metric label="Opportunities" value={openOpportunities} detail="observations" />
      <Metric label="Streak" value={`${streak} day${streak === 1 ? '' : 's'}`} detail={streak ? 'consecutive active days' : 'one action starts it'} />
    </section>
  );
}

function Reminders() {
  const { data, update } = useStore();
  const ui = useUi();
  const { status } = useSync();
  const reminders = computeReminders(data, { lastSyncedAt: status.lastSyncedAt });
  if (!reminders.length) return null;

  const act = (reminder: Reminder) => {
    if (reminder.action?.command === 'export') ui.exportBackup();
    else if (reminder.action?.command === 'start-session') ui.openStartSession();
    else if (reminder.action?.route) navigate(reminder.action.route);
  };

  return (
    <ul className="reminders" aria-label="Reminders">
      {reminders.map(reminder => (
        <li key={reminder.key} className={`reminder reminder--${reminder.tone}`}>
          <Icon name={reminder.tone === 'attention' ? 'alert' : 'flag'} size={16} />
          <p>{reminder.text}</p>
          {reminder.action && <Button size="sm" onClick={() => act(reminder)}>{reminder.action.label}</Button>}
          <button type="button" className="icon-btn icon-btn--sm" aria-label="Dismiss reminder" onClick={() => update(current => dismissReminder(current, reminder.key))}>
            <Icon name="close" size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
