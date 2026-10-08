import { useState } from 'react';
import { getWeek } from '../../curriculum';
import { Button, Card, ConfirmDialog, TextArea } from '../../components/ui';
import { setTryFirst } from '../../store/actions';
import { useStore } from '../../store/store';
import { weekProgress } from '../../lib/progress';

/**
 * Anti-tutorial mode. Each layer of help unlocks only after the previous one:
 * attempt → hint → explanation → solution. Productive struggle first.
 */
export function TryFirst({ n }: { n: number }) {
  const { data, update } = useStore();
  const task = getWeek(n)!.tryFirst;
  const progress = weekProgress(data, n).tryFirst;
  const [attempt, setAttempt] = useState(progress.attempt);
  const [confirmSolution, setConfirmSolution] = useState(false);
  const level = progress.level;

  const saveAttempt = () => update(current => setTryFirst(current, n, 1, attempt));

  return (
    <Card label="Try first" className="try-first">
      <p className="try-first__task">{task.task}</p>

      {level === 0 ? (
        <>
          <TextArea
            label="Your attempt: write your approach or paste your code"
            value={attempt}
            onChange={setAttempt}
            rows={3}
            hint="Hints unlock after you’ve made a real attempt. Wrong is fine. Blank isn’t."
          />
          <Button variant="primary" onClick={saveAttempt} disabled={attempt.trim().length < 10}>
            I’ve tried it myself
          </Button>
        </>
      ) : (
        <details className="try-first__attempt">
          <summary>Your attempt</summary>
          <p>{progress.attempt || '—'}</p>
        </details>
      )}

      {level >= 2 && (
        <div className="try-first__reveal">
          <p className="mono-label">Hint</p>
          <p>{task.hint}</p>
        </div>
      )}
      {level >= 3 && (
        <div className="try-first__reveal">
          <p className="mono-label">Explanation</p>
          <p>{task.explanation}</p>
        </div>
      )}
      {level >= 4 && (
        <div className="try-first__reveal">
          <p className="mono-label">One possible solution</p>
          <pre className="code"><code>{task.solution}</code></pre>
          <p className="section__hint">Compare it with yours. What’s different, and why? Then close this and rebuild it from memory.</p>
        </div>
      )}

      {level >= 1 && level < 4 && (
        <div className="button-row try-first__steps">
          {level === 1 && <Button size="sm" onClick={() => update(current => setTryFirst(current, n, 2))}>Show hint</Button>}
          {level === 2 && <Button size="sm" onClick={() => update(current => setTryFirst(current, n, 3))}>Show explanation</Button>}
          {level === 3 && <Button size="sm" onClick={() => setConfirmSolution(true)}>Show solution</Button>}
        </div>
      )}

      {confirmSolution && (
        <ConfirmDialog
          title="Show the solution?"
          body={
            <>
              <p>Have you spent at least 15 focused minutes with the hint and explanation?</p>
              <p className="muted">Solutions are for comparing, not copying. You’ll learn more by rebuilding it after.</p>
            </>
          }
          confirmLabel="Show solution"
          onCancel={() => setConfirmSolution(false)}
          onConfirm={() => {
            update(current => setTryFirst(current, n, 4));
            setConfirmSolution(false);
          }}
        />
      )}
    </Card>
  );
}
