import { useEffect, useState, type ReactNode } from 'react';
import { TOTAL_WEEKS, areaLabel, getMasteryTest, getMonth, getWeek } from '../../curriculum';
import { BuildStatusPill, MasteryStatePill, WeekStatusPill } from '../../components/domain';
import { Icon } from '../../components/Icon';
import { Button, Card, Checkbox, ConfirmDialog, Dialog, ExternalLink, LinkButton, Pill, SelectField, TextArea, TextField } from '../../components/ui';
import { minutesForWeek } from '../../lib/activity';
import { addDays, formatDate, formatDateLong, formatMinutes } from '../../lib/dates';
import { RESOURCE_TYPE_LABELS, SESSION_TYPE_LABELS } from '../../lib/labels';
import { effectiveState, masteryProgress } from '../../lib/mastery';
import {
  STANDARD_REFLECTION,
  isMasteryPending,
  plannedStart,
  sectionDone,
  sectionState,
  weekProgress,
  weekStatus,
} from '../../lib/progress';
import {
  deleteSession,
  reopenWeek,
  setBlocked,
  setBuildDone,
  setProveDone,
  setReflection,
  setShip,
  setWeekBuild,
  setWeekNotes,
  startWeek,
  toggleWeekItem,
} from '../../store/actions';
import { useStore } from '../../store/store';
import { useUi } from '../shell/ui-context';
import { useCreateBuild } from '../builds/useCreateBuild';
import { TryFirst } from './TryFirst';
import { WeeklyReviewDialog } from './WeeklyReview';

export function WeekView({ n, openReview }: { n: number; openReview: boolean }) {
  const { data, update } = useStore();
  const ui = useUi();
  const week = getWeek(n)!;
  const month = getMonth(week.month)!;
  const progress = weekProgress(data, n);
  const state = sectionState(data, week);
  const status = weekStatus(data, week);
  const [reviewOpen, setReviewOpen] = useState(openReview && !progress.completedAt);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const start = plannedStart(data, n);

  useEffect(() => {
    if (openReview && !progress.completedAt) setReviewOpen(true);
  }, [openReview, progress.completedAt]);

  return (
    <article className="week">
      <header className="page-header week__header">
        <div className="page-header__text">
          <p className="eyebrow">
            Week {String(n).padStart(2, '0')} / {TOTAL_WEEKS} · Month {month.n}: {month.title} · planned {formatDate(start)} – {formatDate(addDays(start, 6))}
          </p>
          <h1>{week.title}</h1>
          <p className="lede">{week.objective}</p>
          <div className="pill-row">
            <WeekStatusPill status={status} />
            {isMasteryPending(data, week) && <Pill tone="warn">Mastery open</Pill>}
            {week.areas.map(area => <Pill key={area} tone="neutral">{areaLabel(area)}</Pill>)}
            <Pill tone="muted">{week.hours[0]}–{week.hours[1]}h</Pill>
          </div>
        </div>
        <div className="page-header__actions">
          <Button variant="secondary" icon="play" onClick={() => { update(current => startWeek(current, n)); ui.openStartSession({ week: n, buildId: progress.buildId }); }}>
            Start session
          </Button>
          {progress.completedAt ? (
            <Button variant="ghost" onClick={() => setReopenOpen(true)}>Reopen week</Button>
          ) : (
            <Button variant="primary" icon="check" onClick={() => setReviewOpen(true)}>Close week</Button>
          )}
        </div>
      </header>

      {progress.completedAt && progress.review && (
        <div className="callout callout--ok">
          <Icon name="check" />
          <div>
            <p><strong>Closed {formatDateLong(progress.completedAt)}</strong> · {progress.review.hours}h reported · decision: {progress.review.decision}</p>
            <p className="muted">{progress.review.built}</p>
          </div>
        </div>
      )}
      {progress.blocked && (
        <div className="callout callout--bad">
          <Icon name="alert" />
          <div>
            <p><strong>Blocked.</strong> {progress.blockedReason || 'No reason written.'}</p>
            <div className="button-row">
              <Button size="sm" icon="bug" onClick={() => ui.openDebug({ week: n, buildId: progress.buildId })}>Debug it step by step</Button>
              <Button size="sm" variant="ghost" onClick={() => update(current => setBlocked(current, n, false))}>Mark unblocked</Button>
            </div>
          </div>
        </div>
      )}

      <div className="week__layout">
        <div className="week__main">
          {/* 01 LEARN */}
          <WeekSection number="01" title="Learn" done={sectionDone(state, 'learn')} meta={`${state.learn.done}/${state.learn.total} concepts`}>
            <ul className="checklist">
              {week.learn.map((text, index) => (
                <li key={text}>
                  <Checkbox checked={progress.checked.includes(`learn:${index}`)} onChange={() => update(current => toggleWeekItem(current, n, `learn:${index}`))}>
                    {text}
                  </Checkbox>
                </li>
              ))}
            </ul>
            <p className="section__hint">Tick a concept when you could explain it to someone, not when you’ve finished reading about it.</p>
          </WeekSection>

          {/* 02 PRACTICE */}
          <WeekSection number="02" title="Practice" done={sectionDone(state, 'practice')} meta={`${state.practice.done}/${state.practice.total} exercises`}>
            <ul className="checklist">
              {week.practice.map((text, index) => (
                <li key={text}>
                  <Checkbox checked={progress.checked.includes(`practice:${index}`)} onChange={() => update(current => toggleWeekItem(current, n, `practice:${index}`))}>
                    {text}
                  </Checkbox>
                </li>
              ))}
            </ul>
          </WeekSection>

          {/* 03 BUILD */}
          <WeekSection number="03" title="Build" done={state.build} meta={week.build.title}>
            <p className="section__brief"><strong>{week.build.title}.</strong> {week.build.brief}</p>
            <BuildLink n={n} buildId={progress.buildId} />
            <Checkbox checked={progress.buildDone} onChange={done => update(current => setBuildDone(current, n, done))}>
              This week’s build step is done: it runs, and I can show it
            </Checkbox>
          </WeekSection>

          {/* 04 PROVE */}
          <WeekSection number="04" title="Prove" done={state.prove} meta={week.masteryId ? 'Mastery test' : 'Proof check'}>
            <ProveSection n={n} />
          </WeekSection>

          {/* 05 REFLECT */}
          <WeekSection number="05" title="Reflect" done={state.reflect} meta="Honest beats impressive">
            <div className="form-stack">
              {STANDARD_REFLECTION.map(question => (
                <TextArea
                  key={question.key}
                  label={question.label}
                  value={progress.reflection[question.key] ?? ''}
                  onChange={value => update(current => setReflection(current, n, question.key, value))}
                  rows={2}
                />
              ))}
              {week.reflect.map((question, index) => (
                <TextArea
                  key={question}
                  label={question}
                  value={progress.reflection[`extra${index}`] ?? ''}
                  onChange={value => update(current => setReflection(current, n, `extra${index}`, value))}
                  rows={2}
                />
              ))}
            </div>
          </WeekSection>

          {/* 06 SHIP */}
          <WeekSection number="06" title="Ship" done={state.ship} meta="Exists outside this app">
            <p className="section__brief">{week.ship}</p>
            <TextField
              label="Evidence: link, repo, or where it lives"
              value={progress.shipEvidence}
              onChange={evidence => update(current => setShip(current, n, { evidence }))}
              placeholder="https://github.com/… or ‘shown to Priya on her phone’"
            />
            <Checkbox
              checked={progress.shipDone}
              disabled={!progress.shipEvidence.trim()}
              onChange={done => update(current => setShip(current, n, { done }))}
            >
              Shipped{!progress.shipEvidence.trim() && <span className="muted">: add evidence first</span>}
            </Checkbox>
          </WeekSection>

          <div className="week__footer">
            <WeekPager n={n} />
            {!progress.completedAt && (
              <div className="button-row">
                {!progress.blocked && <Button variant="ghost" icon="flag" onClick={() => setBlockOpen(true)}>I’m blocked</Button>}
                <Button variant="primary" icon="check" onClick={() => setReviewOpen(true)}>Close week with a review</Button>
              </div>
            )}
          </div>
        </div>

        <aside className="week__side" aria-label="Week tools">
          <TryFirst n={n} />
          <ResourcesCard n={n} />
          <WeekTimeCard n={n} />
          <Card label="Notes">
            <TextArea label="Scratch notes for this week" value={progress.notes} onChange={notes => update(current => setWeekNotes(current, n, notes))} rows={4} />
          </Card>
          <Card label="Stuck?">
            <div className="button-col">
              <Button icon="bug" onClick={() => ui.openDebug({ week: n, buildId: progress.buildId })}>Debug mode</Button>
              <Button icon="coach" onClick={() => ui.openCoach('coach', `Week ${n}: ${week.title}. Objective: ${week.objective}`)}>Ask the coach</Button>
            </div>
          </Card>
        </aside>
      </div>

      {reviewOpen && <WeeklyReviewDialog n={n} onClose={() => setReviewOpen(false)} />}
      {blockOpen && <BlockDialog n={n} onClose={() => setBlockOpen(false)} />}
      {reopenOpen && (
        <ConfirmDialog
          title={`Reopen Week ${n}?`}
          body={<p>The week goes back to “in progress”. Your review, reflections and evidence are kept.</p>}
          confirmLabel="Reopen"
          onCancel={() => setReopenOpen(false)}
          onConfirm={() => { update(current => reopenWeek(current, n)); setReopenOpen(false); }}
        />
      )}
    </article>
  );
}

function WeekSection({ number, title, done, meta, children }: { number: string; title: string; done: boolean; meta?: string; children: ReactNode }) {
  return (
    <section className={`week-section ${done ? 'is-done' : ''}`} aria-labelledby={`section-${number}`}>
      <header className="week-section__head">
        <span className="week-section__number mono">{number}</span>
        <h2 id={`section-${number}`}>{title}</h2>
        {meta && <span className="week-section__meta">{meta}</span>}
        <span className={`week-section__state ${done ? 'is-done' : ''}`}>
          {done ? <><Icon name="check" size={14} /> Done</> : 'Open'}
        </span>
      </header>
      <div className="week-section__body">{children}</div>
    </section>
  );
}

function BuildLink({ n, buildId }: { n: number; buildId: string | null }) {
  const { data, update } = useStore();
  const createBuild = useCreateBuild();
  const build = data.builds.find(item => item.id === buildId);
  return (
    <div className="build-link">
      {build ? (
        <a className="mini-record" href={`#/builds/${build.id}`}>
          <span className="mini-record__title">{build.name}</span>
          <span className="mini-record__meta"><BuildStatusPill status={build.status} /> {build.technology.join(' · ')}</span>
        </a>
      ) : (
        <p className="muted">No build linked yet.</p>
      )}
      <div className="build-link__controls">
        <SelectField
          label="Linked build"
          value={buildId ?? ''}
          onChange={value => update(current => setWeekBuild(current, n, value || null))}
          options={[{ value: '', label: 'None' }, ...data.builds.map(item => ({ value: item.id, label: item.name }))]}
        />
        <Button size="sm" icon="plus" onClick={() => createBuild({ week: n, linkToWeek: true })}>New build for this week</Button>
      </div>
    </div>
  );
}

function ProveSection({ n }: { n: number }) {
  const { data, update } = useStore();
  const week = getWeek(n)!;
  const progress = weekProgress(data, n);
  if (week.masteryId) {
    const test = getMasteryTest(week.masteryId)!;
    const mastery = masteryProgress(data, test.id);
    return (
      <div className="prove">
        <a className="mini-record mini-record--mastery" href={`#/mastery/${test.id}`}>
          <span className="mono-label">Mastery test</span>
          <span className="mini-record__title">{test.title}</span>
          <span className="mini-record__body">{test.challenge}</span>
          <span className="mini-record__meta"><MasteryStatePill state={effectiveState(mastery)} /> {mastery.criteria.length}/{test.criteria.length} criteria met</span>
        </a>
        <p className="section__hint">This section completes only when the test is passed, with evidence. Clicking a box isn’t enough.</p>
      </div>
    );
  }
  return (
    <div className="prove">
      <p className="section__brief">{week.prove}</p>
      <Checkbox checked={progress.proveDone} onChange={done => update(current => setProveDone(current, n, done))}>
        I did this proof check, without notes or a tutorial
      </Checkbox>
      <p className="section__hint">Write what happened in the Build Log, especially if it went badly.</p>
    </div>
  );
}

function ResourcesCard({ n }: { n: number }) {
  const { data } = useStore();
  const week = getWeek(n)!;
  const own = data.resources.filter(resource => resource.week === n);
  return (
    <Card label="Resources · to unblock this build">
      <ul className="resource-list">
        {week.resources.map(resource => (
          <li key={resource.url}>
            <ExternalLink href={resource.url}>{resource.title}</ExternalLink>
            <span className="resource-list__type">{RESOURCE_TYPE_LABELS[resource.type]}</span>
          </li>
        ))}
        {own.map(resource => (
          <li key={resource.id}>
            <ExternalLink href={resource.url}>{resource.title}</ExternalLink>
            <span className="resource-list__type">Yours · {RESOURCE_TYPE_LABELS[resource.type]}</span>
          </li>
        ))}
      </ul>
      <LinkButton href="#/resources" size="sm" variant="ghost">All resources</LinkButton>
    </Card>
  );
}

function WeekTimeCard({ n }: { n: number }) {
  const { data, update } = useStore();
  const ui = useUi();
  const week = getWeek(n)!;
  const sessions = data.sessions.filter(session => session.week === n).sort((a, b) => b.start.localeCompare(a.start));
  return (
    <Card label="Time on this week">
      <p className="big-number">{formatMinutes(minutesForWeek(data, n))}<span className="muted"> / {week.hours[0]}–{week.hours[1]}h planned</span></p>
      {sessions.length > 0 && (
        <ul className="session-list">
          {sessions.slice(0, 6).map(session => (
            <li key={session.id}>
              <span className="mono">{formatDate(session.start)}</span>
              <span>{SESSION_TYPE_LABELS[session.type]} · {formatMinutes(session.minutes)}</span>
              <button type="button" className="icon-btn icon-btn--sm" aria-label={`Delete ${formatMinutes(session.minutes)} session on ${formatDate(session.start)}`} onClick={() => update(current => deleteSession(current, session.id))}>
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="text-btn" onClick={() => ui.openLogTime({ week: n })}>Log time manually</button>
    </Card>
  );
}

function WeekPager({ n }: { n: number }) {
  return (
    <nav className="pager" aria-label="Week navigation">
      {n > 1 ? <LinkButton href={`#/curriculum/week/${n - 1}`} variant="ghost" icon="chevronLeft">Week {n - 1}</LinkButton> : <span />}
      {n < TOTAL_WEEKS && <LinkButton href={`#/curriculum/week/${n + 1}`} variant="ghost">Week {n + 1} <Icon name="chevronRight" size={16} /></LinkButton>}
    </nav>
  );
}

function BlockDialog({ n, onClose }: { n: number; onClose: () => void }) {
  const { update } = useStore();
  const [reason, setReason] = useState('');
  return (
    <Dialog
      title="What’s blocking you?"
      size="sm"
      onClose={onClose}
      description="Being blocked is information, not failure. Naming it is the first debugging step."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => { update(current => setBlocked(current, n, true, reason.trim())); onClose(); }}>Mark blocked</Button>
        </>
      }
    >
      <TextArea label="Describe the blocker" value={reason} onChange={setReason} rows={3} placeholder="e.g. git push keeps getting rejected and I don’t understand the error" autoFocus />
    </Dialog>
  );
}
