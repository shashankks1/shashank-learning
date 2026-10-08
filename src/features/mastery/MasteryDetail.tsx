import { useState } from 'react';
import type { MasteryProgress, MasteryState } from '../../types';
import { areaLabel, getMasteryTest, getWeek } from '../../curriculum';
import { AiAssistFields, ImageField, MasteryStatePill } from '../../components/domain';
import { Icon } from '../../components/Icon';
import { Button, Card, Checkbox, ConfirmDialog, EmptyState, LinkButton, PageHeader, Segmented, TextArea, TextField } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { formatDateLong } from '../../lib/dates';
import {
  MANUAL_STATES,
  MASTERY_STATE_LABELS,
  MIN_EXPLANATION_CHARS,
  MIN_REFLECTION_CHARS,
  effectiveState,
  masteryProgress,
  passBlockers,
} from '../../lib/mastery';
import {
  recordMasteryNotYet,
  recordMasteryPass,
  recordMasteryReverified,
  toggleMasteryCriterion,
  updateMastery,
  withdrawMasteryPass,
} from '../../store/actions';
import { useStore } from '../../store/store';
import type { EvidenceKind } from '../../types';

const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  github: 'Repository URL',
  live: 'Live / deployed URL',
  screenshot: 'Screenshot',
  explanation: 'Explanation in your own words',
  document: 'Document (link or pasted text)',
};

export default function MasteryDetail({ id }: { id: string }) {
  const { data, update } = useStore();
  const toast = useToast();
  const test = getMasteryTest(id);
  const [attemptNote, setAttemptNote] = useState('');
  const [reexplain, setReexplain] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  if (!test) return <EmptyState title="Mastery test not found" action={<LinkButton href="#/mastery">All tests</LinkButton>} />;

  const progress = masteryProgress(data, id);
  const state = effectiveState(progress);
  const passed = state === 'passed' || state === 'needs-review';
  const blockers = passBlockers(test, progress);
  const week = getWeek(test.week)!;
  const patch = (change: Partial<MasteryProgress>) => update(current => updateMastery(current, id, change));
  const patchEvidence = (change: Partial<MasteryProgress['evidence']>) => patch({ evidence: { ...progress.evidence, ...change } });
  const required = new Set(test.evidence);
  const requiredTag = (kind: EvidenceKind) => (required.has(kind) ? ' · required' : ' · optional');

  return (
    <article className="detail mastery-detail">
      <PageHeader
        eyebrow={`Mastery test · Week ${test.week}: ${week.title} · ${areaLabel(test.area)}`}
        title={test.title}
        lede={<span className="pill-row"><MasteryStatePill state={state} />{progress.passedAt && <span className="mono">passed {formatDateLong(progress.passedAt)}{progress.reviewDueAt ? ` · re-check ${formatDateLong(progress.reviewDueAt)}` : ''}</span>}</span>}
        actions={<LinkButton href={`#/curriculum/week/${test.week}`} icon="curriculum">Week {test.week}</LinkButton>}
      />

      <div className="detail__layout">
        <div className="detail__main">
          <Card label="Challenge">
            <p className="mastery-challenge">{test.challenge}</p>
            <p className="mono-label">Constraints: what you may use</p>
            <ul className="plain-list bullets">
              {test.constraints.map(item => <li key={item}>{item}</li>)}
            </ul>
          </Card>

          <Card label="Success criteria" title={`${progress.criteria.length} of ${test.criteria.length} met`}>
            <p className="card__note">Tick a criterion only when you could show it to a sceptical reviewer right now.</p>
            <ul className="checklist">
              {test.criteria.map((criterion, index) => (
                <li key={criterion}>
                  <Checkbox checked={progress.criteria.includes(index)} disabled={passed} onChange={() => update(current => toggleMasteryCriterion(current, id, index))}>
                    {criterion}
                  </Checkbox>
                </li>
              ))}
            </ul>
          </Card>

          <Card label="Evidence">
            <div className="form-grid form-grid--2">
              <TextField label={`${EVIDENCE_LABELS.github}${requiredTag('github')}`} type="url" value={progress.evidence.github} onChange={github => patchEvidence({ github: github.trim() })} placeholder="https://github.com/…" />
              <TextField label={`${EVIDENCE_LABELS.live}${requiredTag('live')}`} type="url" value={progress.evidence.live} onChange={live => patchEvidence({ live: live.trim() })} placeholder="https://…" />
            </div>
            <TextArea
              label={`${EVIDENCE_LABELS.explanation}${requiredTag('explanation')}`}
              value={progress.evidence.explanation}
              onChange={explanation => patchEvidence({ explanation })}
              rows={5}
              hint={`${progress.evidence.explanation.trim().length} / ${MIN_EXPLANATION_CHARS}+ characters. Write it as if explaining to a colleague, without notes.`}
            />
            <TextArea label={`${EVIDENCE_LABELS.document}${requiredTag('document')}`} value={progress.evidence.document} onChange={document => patchEvidence({ document })} rows={2} />
            <ImageField label={`${EVIDENCE_LABELS.screenshot}${requiredTag('screenshot')}`} imageId={progress.evidence.screenshotId} onChange={screenshotId => patchEvidence({ screenshotId })} />
          </Card>

          <Card label="Reflection">
            <TextArea
              label="What did you actually understand, and what’s still shaky?"
              value={progress.reflection}
              onChange={reflection => patch({ reflection })}
              rows={4}
              hint={`${progress.reflection.trim().length} / ${MIN_REFLECTION_CHARS}+ characters`}
            />
          </Card>

          <Card label="AI ownership check">
            <AiAssistFields value={progress.ai} onChange={ai => patch({ ai })} />
          </Card>
        </div>

        <aside className="detail__side">
          {!passed && (
            <Card label="Where are you with this?">
              <Segmented<MasteryState>
                label="Stage"
                hideLabel
                value={progress.state}
                options={MANUAL_STATES.map(value => ({ value, label: MASTERY_STATE_LABELS[value] }))}
                onChange={value => patch({ state: value })}
              />
            </Card>
          )}

          {!passed && (
            <Card label="Attempt the test" className="attempt-card">
              <Checkbox checked={progress.withinConstraints} onChange={withinConstraints => patch({ withinConstraints })}>
                I worked within the stated constraints
              </Checkbox>
              {blockers.length > 0 ? (
                <div className="blockers" role="status">
                  <p className="mono-label">Before you can record a pass</p>
                  <ul>
                    {blockers.map(blocker => <li key={blocker}><Icon name="alert" size={14} /> {blocker}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="ok-text"><Icon name="check" size={14} /> Every requirement is met. If you stand behind it, record the pass.</p>
              )}
              <TextArea label="Attempt note" value={attemptNote} onChange={setAttemptNote} rows={2} placeholder="How it went, how long it took, what you’d redo" />
              <div className="button-col">
                <Button
                  variant="primary"
                  icon="check"
                  disabled={blockers.length > 0}
                  onClick={() => {
                    update(current => recordMasteryPass(current, id, attemptNote));
                    setAttemptNote('');
                    toast(`Passed: ${test.title}`, 'success');
                  }}
                >
                  Record pass
                </Button>
                <Button
                  onClick={() => {
                    update(current => recordMasteryNotYet(current, id, attemptNote));
                    setAttemptNote('');
                    toast('Attempt recorded. “Not yet” is how mastery is built.');
                  }}
                >
                  Not yet: record the attempt
                </Button>
              </div>
            </Card>
          )}

          {state === 'needs-review' && (
            <Card label="Re-check due" className="attempt-card">
              <p className="card__note">It’s been a while. Without looking at your notes or code, explain the core of this capability again.</p>
              <TextArea label="Explain it again, now" value={reexplain} onChange={setReexplain} rows={4} hint={`${reexplain.trim().length} / ${MIN_REFLECTION_CHARS}+ characters`} />
              <Button
                variant="primary"
                disabled={reexplain.trim().length < MIN_REFLECTION_CHARS}
                onClick={() => {
                  update(current => recordMasteryReverified(current, id, reexplain));
                  setReexplain('');
                  toast('Re-verified. Next re-check in 60 days.', 'success');
                }}
              >
                Re-verify
              </Button>
            </Card>
          )}

          {passed && (
            <Card label="Honesty">
              <p className="card__note">If you no longer stand behind this pass, step it back. That’s a strength, not a loss.</p>
              <Button size="sm" variant="ghost" onClick={() => setConfirmWithdraw(true)}>Withdraw pass</Button>
            </Card>
          )}

          <Card label="Attempts">
            {progress.attempts.length === 0 ? (
              <p className="card__note">No attempts yet.</p>
            ) : (
              <ol className="attempts">
                {[...progress.attempts].reverse().map(attempt => (
                  <li key={attempt.id}>
                    <span className={`mono-label ${attempt.result === 'not-yet' ? '' : 'ok-text'}`}>{attempt.result === 'passed' ? 'Passed' : attempt.result === 'reverified' ? 'Re-verified' : 'Not yet'}</span>
                    <span className="mono muted">{formatDateLong(attempt.at)}</span>
                    {attempt.note && <p>{attempt.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>

      {confirmWithdraw && (
        <ConfirmDialog
          title="Withdraw this pass?"
          body={<p>The test goes back to “Practicing”. Your evidence and history stay; the withdrawal is recorded as an attempt.</p>}
          confirmLabel="Withdraw"
          onCancel={() => setConfirmWithdraw(false)}
          onConfirm={() => {
            update(current => withdrawMasteryPass(current, id, 'Withdrawn: I want to prove this again.'));
            setConfirmWithdraw(false);
          }}
        />
      )}
    </article>
  );
}
