import { useState } from 'react';
import type { CareerExperiment, ExperimentStatus, ExperimentType } from '../../types';
import { Icon } from '../../components/Icon';
import { Button, Card, ConfirmDialog, Dialog, EmptyState, NumberField, PageHeader, Pill, SelectField, TextArea, TextField } from '../../components/ui';
import { CAREER_STAGES, EXPERIMENT_STATUS_LABELS, EXPERIMENT_TYPE_LABELS, careerEvidence } from '../../lib/career';
import { formatDateLong, nowISO, today } from '../../lib/dates';
import { formatINR } from '../../lib/format';
import { createId } from '../../lib/id';
import { milestoneStates } from '../../lib/milestones';
import { addActivity, addExperiment, deleteExperiment, updateExperiment } from '../../store/actions';
import { useStore } from '../../store/store';
import { RunwayCalculator } from './RunwayCalculator';

const TYPE_OPTIONS = (Object.keys(EXPERIMENT_TYPE_LABELS) as ExperimentType[]).map(value => ({ value, label: EXPERIMENT_TYPE_LABELS[value] }));
const STATUS_OPTIONS = (Object.keys(EXPERIMENT_STATUS_LABELS) as ExperimentStatus[]).map(value => ({ value, label: EXPERIMENT_STATUS_LABELS[value] }));

export default function CareerPage() {
  const { data, update } = useStore();
  const [editing, setEditing] = useState<CareerExperiment | null>(null);
  const [typeFilter, setTypeFilter] = useState<'' | ExperimentType>('');
  const hide = data.settings.hideFinancials;
  const evidence = careerEvidence(data);
  const experiments = [...data.career.experiments]
    .filter(item => !typeFilter || item.type === typeFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const setCareer = (change: Partial<typeof data.career>) => update(current => ({ ...current, career: { ...current.career, ...change } }));
  const newExperiment = (): CareerExperiment => ({ id: createId('x'), type: 'application', title: '', org: '', date: today(), status: 'planned', outcome: '', notes: '', amount: null });

  return (
    <>
      <PageHeader
        eyebrow="Career"
        title="Earning power, built on evidence"
        lede="Directional targets, never promises. What makes them likelier is evidence: shipped builds, passed tests, real conversations, money earned."
        actions={
          <Button
            variant="secondary"
            aria-pressed={hide}
            onClick={() => update(current => ({ ...current, settings: { ...current.settings, hideFinancials: !current.settings.hideFinancials } }))}
          >
            {hide ? 'Show amounts' : 'Hide amounts'}
          </Button>
        }
      />

      <div className="callout callout--principle">
        <Icon name="flag" />
        <p><strong>Protect the floor; raise the ceiling.</strong> Don’t resign for a speculative idea. Change roles on a signed offer, and take product bets only with runway.</p>
      </div>

      <div className="career-grid">
        <Card label="Current">
          <TextField label="Role" value={data.career.current.role} onChange={role => setCareer({ current: { ...data.career.current, role } })} />
          {hide ? <p className="field-static"><span className="mono-label">Monthly income</span> ••••</p> : (
            <NumberField label="Monthly income" prefix="₹" value={data.career.current.income} onChange={income => setCareer({ current: { ...data.career.current, income } })} />
          )}
          <TextField label="Technical capability" value={data.career.current.techLevel} onChange={techLevel => setCareer({ current: { ...data.career.current, techLevel } })} />
        </Card>
        <Card label="Target">
          <TextField label="Desired role" value={data.career.target.role} onChange={role => setCareer({ target: { ...data.career.target, role } })} />
          {hide ? <p className="field-static"><span className="mono-label">Desired income</span> ••••</p> : (
            <NumberField label="Desired monthly income" prefix="₹" value={data.career.target.income} onChange={income => setCareer({ target: { ...data.career.target, income } })} />
          )}
          <TextField label="Desired technical level" value={data.career.target.techLevel} onChange={techLevel => setCareer({ target: { ...data.career.target, techLevel } })} />
        </Card>
        <Card label="Evidence" title="What the market can see">
          <ul className="evidence-grid">
            <li><strong>{evidence.projects}</strong> projects completed</li>
            <li><strong>{evidence.github}</strong> on GitHub</li>
            <li><strong>{evidence.portfolio}</strong> portfolio proofs</li>
            <li><strong>{evidence.applications}</strong> applications</li>
            <li><strong>{evidence.interviews}</strong> interviews</li>
            <li><strong>{evidence.freelance}</strong> freelance wins</li>
            <li><strong>{evidence.offers}</strong> offers</li>
          </ul>
          <p className="card__note">Counted from your builds, portfolio and experiments, so it can’t drift from reality.</p>
        </Card>
      </div>

      <Card label="The path" title="Nine stages, in order">
        <p className="card__note">Choose the stage you’re honestly at. Stages 5–9 depend on the ones before them: runway before bets.</p>
        <ol className="stages">
          {CAREER_STAGES.map(stage => (
            <li key={stage.n} className={stage.n === data.career.stage ? 'is-current' : stage.n < data.career.stage ? 'is-past' : ''}>
              <button type="button" onClick={() => setCareer({ stage: stage.n })} aria-pressed={stage.n === data.career.stage}>
                <span className="stages__n mono">{stage.n}</span>
                <span className="stages__title">{hide && stage.n <= 4 ? `Stage ${stage.n}` : stage.title}</span>
                <span className="stages__note">{stage.note}</span>
              </button>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        label="Career experiments"
        title={`${data.career.experiments.length} logged`}
        actions={<Button variant="primary" size="sm" icon="plus" onClick={() => setEditing(newExperiment())}>Log experiment</Button>}
      >
        <SelectField<'' | ExperimentType> label="Type" value={typeFilter} onChange={setTypeFilter} options={[{ value: '', label: 'All types' }, ...TYPE_OPTIONS]} className="inline-field" />
        {experiments.length === 0 ? (
          <EmptyState title="No experiments yet.">Applications, freelance leads, coffee chats, interviews, client work, product tests. Each one is data about the market.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>What</th><th>Status</th><th>Outcome</th><th><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {experiments.map(item => (
                  <tr key={item.id}>
                    <td className="mono">{formatDateLong(item.date)}</td>
                    <td>{EXPERIMENT_TYPE_LABELS[item.type]}</td>
                    <td><strong>{item.title}</strong>{item.org && <span className="muted"> · {item.org}</span>}{item.amount !== null && !hide && <span className="muted"> · {formatINR(item.amount)}</span>}</td>
                    <td><Pill tone={item.status === 'won' ? 'ok' : item.status === 'lost' ? 'muted' : item.status === 'active' ? 'accent' : 'neutral'}>{EXPERIMENT_STATUS_LABELS[item.status]}</Pill></td>
                    <td className="table__wrap">{item.outcome || item.notes}</td>
                    <td><Button size="sm" variant="ghost" onClick={() => setEditing(item)}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="career-grid career-grid--2">
        <IncomeHistory />
        <MilestoneClaims />
      </div>

      <RunwayCalculator />

      {editing && (
        <ExperimentDialog
          experiment={editing}
          isNew={!data.career.experiments.some(item => item.id === editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function ExperimentDialog({ experiment, isNew, onClose }: { experiment: CareerExperiment; isNew: boolean; onClose: () => void }) {
  const { update } = useStore();
  const [draft, setDraft] = useState(experiment);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof CareerExperiment>(key: K) => (value: CareerExperiment[K]) => setDraft(current => ({ ...current, [key]: value }));
  const save = () => {
    if (!draft.title.trim()) return;
    update(current => (isNew ? addExperiment(current, draft) : updateExperiment(current, draft.id, draft)));
    onClose();
  };
  return (
    <Dialog
      title={isNew ? 'Log a career experiment' : 'Edit experiment'}
      onClose={onClose}
      footer={
        <>
          {!isNew && <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Delete</Button>}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!draft.title.trim()}>Save</Button>
        </>
      }
    >
      <div className="form-grid form-grid--2">
        <SelectField<ExperimentType> label="Type" value={draft.type} onChange={set('type')} options={TYPE_OPTIONS} />
        <SelectField<ExperimentStatus> label="Status" value={draft.status} onChange={set('status')} options={STATUS_OPTIONS} />
        <TextField label="What" value={draft.title} onChange={set('title')} placeholder="e.g. Design engineer role at …" autoFocus />
        <TextField label="Organisation / person" value={draft.org} onChange={set('org')} />
        <TextField label="Date" type="date" value={draft.date} onChange={set('date')} />
        <NumberField label="Amount (if paid work or an offer)" prefix="₹" value={draft.amount} onChange={set('amount')} />
      </div>
      <TextArea label="Outcome / what you learned" value={draft.outcome} onChange={set('outcome')} rows={2} />
      <TextArea label="Notes" value={draft.notes} onChange={set('notes')} rows={2} />
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this experiment?"
          body={<p>It’s removed from your career record.</p>}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => { update(current => deleteExperiment(current, draft.id)); onClose(); }}
        />
      )}
    </Dialog>
  );
}

function IncomeHistory() {
  const { data, update } = useStore();
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const hide = data.settings.hideFinancials;
  const history = [...data.career.incomeHistory].sort((a, b) => a.date.localeCompare(b.date));

  const add = () => {
    if (amount === null) return;
    update(current => addActivity({
      ...current,
      career: { ...current.career, incomeHistory: [...current.career.incomeHistory, { id: createId('i'), date, amount, note: note.trim() }] },
    }, 'career', 'Recorded an income change'));
    setAmount(null);
    setNote('');
  };

  return (
    <Card label="Income trajectory" title="Monthly income over time">
      {history.length === 0 ? (
        <p className="card__note">Record your monthly income when it changes. It’s the honest measure of earning power.</p>
      ) : (
        <ol className="income-list">
          {history.map((record, index) => {
            const previous = history[index - 1];
            const change = previous ? record.amount - previous.amount : 0;
            return (
              <li key={record.id}>
                <span className="mono">{formatDateLong(record.date)}</span>
                <strong>{hide ? '••••' : formatINR(record.amount)}</strong>
                {previous && !hide && <span className={change >= 0 ? 'ok-text' : 'warn-text'}>{change >= 0 ? '+' : ''}{formatINR(change)}</span>}
                <span className="muted">{record.note}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  aria-label={`Remove income record from ${record.date}`}
                  onClick={() => update(current => ({ ...current, career: { ...current.career, incomeHistory: current.career.incomeHistory.filter(item => item.id !== record.id) } }))}
                >
                  <Icon name="trash" size={14} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {!hide && (
        <div className="inline-form">
          <NumberField label="Monthly income" prefix="₹" value={amount} onChange={setAmount} />
          <TextField label="From" type="date" value={date} onChange={setDate} />
          <TextField label="Why it changed" value={note} onChange={setNote} />
          <Button icon="plus" onClick={add} disabled={amount === null}>Record</Button>
        </div>
      )}
    </Card>
  );
}

function MilestoneClaims() {
  const { data, update } = useStore();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [evidence, setEvidence] = useState('');
  const states = milestoneStates(data);
  const target = states.find(state => state.definition.id === claiming);

  return (
    <Card label="Milestones" title={`${states.filter(state => state.achieved).length} of ${states.length}, all evidence-based`}>
      <ul className="milestones milestones--full">
        {states.map(state => (
          <li key={state.definition.id} className={state.achieved ? 'is-achieved' : ''}>
            {state.achieved ? <Icon name="check" size={14} /> : <span className="milestones__dot" aria-hidden="true" />}
            <span>{state.definition.title}</span>
            <span className="milestones__evidence">
              {state.achieved ? `${state.source === 'detected' ? 'Detected' : 'Claimed'}: ${state.evidence}` : state.definition.bar}
            </span>
            {!state.achieved && (
              <button type="button" className="text-btn" onClick={() => { setClaiming(state.definition.id); setEvidence(''); }}>Claim with evidence</button>
            )}
            {state.source === 'claimed' && (
              <button
                type="button"
                className="text-btn"
                onClick={() => update(current => {
                  const milestones = { ...current.milestones };
                  delete milestones[state.definition.id];
                  return { ...current, milestones };
                })}
              >
                Withdraw
              </button>
            )}
          </li>
        ))}
      </ul>
      {target && (
        <Dialog
          title={`Claim: ${target.definition.title}`}
          size="sm"
          onClose={() => setClaiming(null)}
          description={<p>{target.definition.bar}</p>}
          footer={
            <>
              <Button variant="ghost" onClick={() => setClaiming(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={evidence.trim().length < 10}
                onClick={() => {
                  update(current => addActivity(
                    { ...current, milestones: { ...current.milestones, [target.definition.id]: { evidence: evidence.trim(), at: nowISO() } } },
                    'career',
                    `Milestone: ${target.definition.title}`,
                  ));
                  setClaiming(null);
                }}
              >
                Claim milestone
              </Button>
            </>
          }
        >
          <TextArea label="Evidence (who, what, link)" value={evidence} onChange={setEvidence} rows={3} hint="At least a sentence. A milestone without evidence is just a feeling." autoFocus />
        </Dialog>
      )}
    </Card>
  );
}
