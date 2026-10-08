import { getMonth, getWeek } from '../../curriculum';
import { Button, Card, Checkbox, EmptyState, LinkButton, PageHeader, Principle } from '../../components/ui';
import { minutesThisWeek } from '../../lib/activity';
import { formatMinutes } from '../../lib/dates';
import { SECTION_LABELS, currentWeekNumber, nextItems, sessionEstimate } from '../../lib/progress';
import { toggleWeekItem } from '../../store/actions';
import { useStore } from '../../store/store';
import { useUi } from '../shell/ui-context';

/** Day/session view: just enough to start working in the next minute. */
export function TodayView() {
  const { data, update } = useStore();
  const ui = useUi();
  const n = currentWeekNumber(data);
  const week = getWeek(n)!;
  const month = getMonth(week.month)!;
  const items = nextItems(data, n, 4);
  const checkable = (key: string) => key.startsWith('learn:') || key.startsWith('practice:');

  return (
    <>
      <PageHeader
        eyebrow={`Today · Week ${n} · Month ${month.n}`}
        title="Today’s session"
        lede={`${week.title}: ${week.objective}`}
        actions={
          <>
            <Button variant="primary" icon="play" onClick={() => ui.openStartSession({ week: n })}>Start session</Button>
            <LinkButton href={`#/curriculum/week/${n}`}>Full week plan</LinkButton>
          </>
        }
      />
      <div className="today-layout">
        <Card label={`Suggested session · ${sessionEstimate(week)}`} title="Work these, in this order">
          {items.length === 0 ? (
            <EmptyState title="This week’s work is done." action={<LinkButton href={`#/curriculum/week/${n}?review`} variant="primary">Close the week</LinkButton>}>
              Write the weekly review to close it and open the next one.
            </EmptyState>
          ) : (
            <ol className="today-list">
              {items.map(item => (
                <li key={item.key}>
                  <span className="mono-label">{SECTION_LABELS[item.section]}</span>
                  {checkable(item.key) ? (
                    <Checkbox checked={false} onChange={() => update(current => toggleWeekItem(current, n, item.key))}>{item.text}</Checkbox>
                  ) : (
                    <a href={`#/curriculum/week/${n}`} className="today-list__link">{item.text}</a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
        <div className="today-side">
          <Card label="This week so far">
            <p className="big-number">{formatMinutes(minutesThisWeek(data))}</p>
            <p className="card__note">Target {data.settings.weeklyTargetMin}–{data.settings.weeklyTargetMax}h. Missing it is fine. Show up again.</p>
          </Card>
          <Card label="Before you look anything up">
            <p className="card__note">{week.tryFirst.task}</p>
            <LinkButton href={`#/curriculum/week/${n}`} size="sm">Try it first</LinkButton>
          </Card>
          <Principle>Build &gt; consume. Debug &gt; avoid mistakes.</Principle>
        </div>
      </div>
    </>
  );
}
