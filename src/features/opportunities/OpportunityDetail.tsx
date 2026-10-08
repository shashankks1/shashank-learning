import { useState } from 'react';
import type { Opportunity, OpportunityEvidence, OpportunityStatus } from '../../types';
import { OpportunityStatusPill } from '../../components/domain';
import { Icon } from '../../components/Icon';
import { Button, Card, ConfirmDialog, EmptyState, LinkButton, PageHeader, SelectField, TextArea, TextField } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { formatDateLong, today } from '../../lib/dates';
import { createId } from '../../lib/id';
import { OPPORTUNITY_STATUSES, OPPORTUNITY_STATUS_LABELS } from '../../lib/labels';
import { OPPORTUNITY_DIMENSIONS } from '../../lib/schema';
import { deleteOpportunity, updateOpportunity } from '../../store/actions';
import { useStore } from '../../store/store';
import { navigate } from '../../router';
import { useUi } from '../shell/ui-context';

const EVIDENCE_KINDS: { value: OpportunityEvidence['kind']; label: string }[] = [
  { value: 'interview', label: 'Interview' },
  { value: 'observation', label: 'Observation' },
  { value: 'data', label: 'Data / numbers' },
  { value: 'article', label: 'Article / report' },
  { value: 'other', label: 'Other' },
];

export default function OpportunityDetail({ id }: { id: string }) {
  const { data, update } = useStore();
  const ui = useUi();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const opportunity = data.opportunities.find(item => item.id === id);
  if (!opportunity) return <EmptyState title="Observation not found" action={<LinkButton href="#/lab">Opportunity Lab</LinkButton>} />;

  const patch = (change: Partial<Opportunity>) => update(current => updateOpportunity(current, id, change));
  const field = (key: keyof Opportunity) => (value: string) => patch({ [key]: value } as Partial<Opportunity>);
  const setScore = (dimension: keyof Opportunity['scores'], change: Partial<{ score: number; note: string }>) =>
    patch({ scores: { ...opportunity.scores, [dimension]: { ...opportunity.scores[dimension], ...change } } });

  return (
    <article className="detail">
      <PageHeader
        eyebrow={`Opportunity Lab · first noted ${formatDateLong(opportunity.createdAt)}`}
        title={opportunity.title || 'Untitled observation'}
        lede={<span className="pill-row"><OpportunityStatusPill status={opportunity.status} /><span className="mono">{opportunity.evidence.length} evidence item{opportunity.evidence.length === 1 ? '' : 's'}</span></span>}
        actions={<Button icon="coach" onClick={() => ui.openCoach('challenger', `Opportunity: ${opportunity.title}. Problem: ${opportunity.problem}. Who: ${opportunity.who}. Evidence: ${opportunity.evidence.map(item => item.summary).join(' | ')}`)}>Challenge this</Button>}
      />

      <div className="detail__layout">
        <div className="detail__main">
          <Card label="The problem">
            <div className="form-grid form-grid--2">
              <TextField label="Short title" value={opportunity.title} onChange={field('title')} placeholder="e.g. Tailors track orders in paper notebooks" autoFocus={!opportunity.title} />
              <SelectField<OpportunityStatus>
                label="Status"
                value={opportunity.status}
                onChange={status => patch({ status })}
                options={OPPORTUNITY_STATUSES.map(status => ({ value: status, label: OPPORTUNITY_STATUS_LABELS[status] }))}
              />
            </div>
            <TextArea label="Problem: what is happening?" value={opportunity.problem} onChange={field('problem')} rows={3} hint="Describe the situation, not your solution." />
            <div className="form-grid form-grid--2">
              <TextArea label="Who experiences it?" value={opportunity.who} onChange={field('who')} rows={2} />
              <TextArea label="Frequency: how often?" value={opportunity.frequency} onChange={field('frequency')} rows={2} />
              <TextArea label="Current workaround" value={opportunity.workaround} onChange={field('workaround')} rows={2} />
              <TextArea label="Cost: time, money, frustration, risk" value={opportunity.cost} onChange={field('cost')} rows={2} />
            </div>
          </Card>

          <Card label="Solutions & leverage">
            <div className="form-grid form-grid--2">
              <TextArea label="Existing solutions" value={opportunity.existingSolutions} onChange={field('existingSolutions')} rows={2} />
              <TextArea label="Why are they insufficient?" value={opportunity.insufficient} onChange={field('insufficient')} rows={2} />
              <TextArea label="AI leverage: could AI materially improve this?" value={opportunity.aiLeverage} onChange={field('aiLeverage')} rows={2} hint="‘Not much’ is a valid, useful answer." />
              <TextArea label="Technical leverage: could software make it much cheaper or faster?" value={opportunity.techLeverage} onChange={field('techLeverage')} rows={2} />
            </div>
            <TextArea label="Distribution: how could customers be reached?" value={opportunity.distribution} onChange={field('distribution')} rows={2} />
          </Card>

          <EvidenceLog opportunity={opportunity} onChange={evidence => patch({ evidence })} />

          <Card label="Unknowns & notes">
            <TextArea label="What don’t we know yet?" value={opportunity.unknowns} onChange={field('unknowns')} rows={3} hint="Each unknown is a test you could run." />
            <TextArea label="Notes" value={opportunity.notes} onChange={field('notes')} rows={3} />
          </Card>
        </div>

        <aside className="detail__side">
          <Card label="Assessment · nine dimensions" className="assessment">
            <p className="card__note">Rate each 1–5 where 5 is favourable. There’s deliberately no total: a strong opportunity can have a weak dimension, and a high average can hide a fatal one. Leave a dimension unscored until you have evidence.</p>
            <ul className="dimensions">
              {OPPORTUNITY_DIMENSIONS.map(dimension => {
                const value = opportunity.scores[dimension.id];
                return (
                  <li key={dimension.id} className="dimension">
                    <div className="dimension__head">
                      <span className="dimension__label">{dimension.label}</span>
                      <span className="dimension__hint">{dimension.hint}</span>
                    </div>
                    <div className="score-picker" role="radiogroup" aria-label={dimension.label}>
                      {[1, 2, 3, 4, 5].map(score => (
                        <button
                          key={score}
                          type="button"
                          role="radio"
                          aria-checked={value.score === score}
                          className={`score-picker__dot ${value.score >= score ? 'is-on' : ''}`}
                          onClick={() => setScore(dimension.id, { score: value.score === score ? 0 : score })}
                        >
                          <span className="visually-hidden">{score}</span>
                        </button>
                      ))}
                      <span className="score-picker__value mono">{value.score ? `${value.score}/5` : 'unscored'}</span>
                    </div>
                    <input
                      className="dimension__note"
                      aria-label={`${dimension.label} note`}
                      placeholder="Why this score?"
                      value={value.note}
                      onChange={event => setScore(dimension.id, { note: event.target.value })}
                    />
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card label="Danger zone">
            <div className="button-col">
              {opportunity.status !== 'archived' && <Button size="sm" onClick={() => patch({ status: 'archived' })}>Archive (keep the record)</Button>}
              <Button size="sm" variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Delete</Button>
            </div>
          </Card>
        </aside>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this observation?"
          body={<p>Archiving keeps it in your history, which is usually better. Deleting removes it for good.</p>}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            update(current => deleteOpportunity(current, id));
            toast('Observation deleted');
            navigate('#/lab');
          }}
        />
      )}
    </article>
  );
}

function EvidenceLog({ opportunity, onChange }: { opportunity: Opportunity; onChange: (evidence: OpportunityEvidence[]) => void }) {
  const [kind, setKind] = useState<OpportunityEvidence['kind']>('interview');
  const [summary, setSummary] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState(today());

  const add = () => {
    if (!summary.trim()) return;
    onChange([...opportunity.evidence, { id: createId('e'), date, kind, summary: summary.trim(), source: source.trim() }]);
    setSummary('');
    setSource('');
  };

  return (
    <Card label="Evidence log" title="What supports this?">
      <p className="card__note">Separate what you saw or heard from what you think it means. Quotes beat paraphrase.</p>
      {opportunity.evidence.length > 0 && (
        <ul className="evidence-log">
          {[...opportunity.evidence].sort((a, b) => b.date.localeCompare(a.date)).map(item => (
            <li key={item.id}>
              <div className="evidence-log__meta">
                <span className="mono-label">{EVIDENCE_KINDS.find(option => option.value === item.kind)?.label}</span>
                <span className="mono muted">{item.date}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  aria-label="Remove evidence"
                  onClick={() => onChange(opportunity.evidence.filter(other => other.id !== item.id))}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <p>{item.summary}</p>
              {item.source && <p className="muted">Source: {item.source}</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="evidence-form">
        <div className="form-grid form-grid--3">
          <SelectField label="Kind" value={kind} onChange={setKind} options={EVIDENCE_KINDS} />
          <TextField label="Date" type="date" value={date} onChange={setDate} />
          <TextField label="Source" value={source} onChange={setSource} placeholder="Who / where" />
        </div>
        <TextArea label="What did you see, hear or find?" value={summary} onChange={setSummary} rows={2} />
        <Button icon="plus" onClick={add} disabled={!summary.trim()}>Add evidence</Button>
      </div>
    </Card>
  );
}
