import { useState, type ReactNode } from 'react';
import { getWeek } from '../../curriculum';
import { Button, Card, ConfirmDialog, LinkButton } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { startOfWeek, today } from '../../lib/dates';
import { currentWeekNumber, realignShift, recoveryState, weekProgress, weeksBehind } from '../../lib/progress';
import { addRebase } from '../../store/actions';
import { useStore } from '../../store/store';
import { useUi } from '../shell/ui-context';

/**
 * Life interferes. This card never resets anything; it offers the next sensible step.
 * 1 week missed → resume · 2–3 → reassess workload · more than 3 → re-entry plan.
 */
export function RecoveryCard() {
  const { data, update } = useStore();
  const ui = useUi();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const recovery = recoveryState(data);
  const behind = weeksBehind(data);
  const current = currentWeekNumber(data);
  const week = getWeek(current)!;
  const shift = realignShift(data, startOfWeek(today()));
  const lastClosed = [...Array(current - 1).keys()].map(index => index + 1).reverse().find(n => weekProgress(data, n).completedAt);

  const rebase = () => {
    update(current => addRebase(current, currentWeekNumber(current), shift, recovery.level === 'none' ? `Behind by ${behind} weeks` : `Returned after ${recovery.weeksMissed} week(s) away`));
    toast(`Plan rebased: Week ${current} starts this week. All history kept.`, 'success');
    setConfirm(false);
  };

  const rebaseButton = shift !== 0 && (
    <Button variant="primary" onClick={() => setConfirm(true)}>Rebase plan to this week</Button>
  );

  let title: string;
  let body: ReactNode;
  if (recovery.level === 'resume') {
    title = 'Welcome back. Resume normally.';
    body = <p>You missed about a week. Pick up Week {current} where you left it. Don’t double up to “catch up”; one normal week is the fix.</p>;
  } else if (recovery.level === 'reassess') {
    title = 'Reassess the workload.';
    body = (
      <>
        <p>About {recovery.weeksMissed} weeks away. That usually means the plan was heavier than life allowed. Two options, both fine:</p>
        <ul className="plain-list">
          <li><strong>Minimum week:</strong> 4 hours, one concept, one build step, one note. Keep the thread.</li>
          <li><strong>Rebase:</strong> move the plan so Week {current} starts now. Nothing is lost.</li>
        </ul>
      </>
    );
  } else if (recovery.level === 'reentry') {
    title = 'A re-entry plan, not a restart.';
    body = (
      <>
        <p>It’s been {recovery.weeksMissed} weeks. Your history is intact. Re-enter in three small steps:</p>
        <ol className="plain-list numbered">
          <li>Re-read your last reflection{lastClosed ? <> (<a href={`#/curriculum/week/${lastClosed}`}>Week {lastClosed}</a>)</> : ''} and your latest <a href="#/log">build log</a> entry.</li>
          <li>One 45-minute session: rebuild a small piece of your last build from memory, no notes.</li>
          <li>Rebase the plan so Week {current} ({week.title}) starts this week.</li>
        </ol>
      </>
    );
  } else {
    title = `You’re ${behind} weeks behind the original plan.`;
    body = <p>That’s normal. Plans are guesses. Rebase so the calendar matches reality; your progress stays exactly as it is.</p>;
  }

  return (
    <Card className="recovery-card" label="Recovery protocol" title={title}>
      <div className="prose">{body}</div>
      <div className="button-row">
        {rebaseButton}
        {recovery.level === 'reentry' && <Button icon="play" onClick={() => ui.openStartSession({ week: lastClosed ?? current })}>Start a 45-minute session</Button>}
        <LinkButton href={`#/curriculum/week/${current}`} variant="ghost">Open Week {current}</LinkButton>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Rebase the plan?"
          body={<p>Week {current} and everything after it moves {Math.abs(shift)} week{Math.abs(shift) === 1 ? '' : 's'} {shift > 0 ? 'later' : 'earlier'}. Closed weeks, builds, reviews and evidence stay exactly as they are. The rebase is recorded in your history.</p>}
          confirmLabel="Rebase"
          onCancel={() => setConfirm(false)}
          onConfirm={rebase}
        />
      )}
    </Card>
  );
}
