import { useState } from 'react';
import type { Opportunity, OpportunityStatus } from '../../types';
import { OpportunityStatusPill } from '../../components/domain';
import { Button, EmptyState, PageHeader, Principle, Segmented, TextField } from '../../components/ui';
import { formatRelative } from '../../lib/dates';
import { OPPORTUNITY_STATUSES, OPPORTUNITY_STATUS_LABELS } from '../../lib/labels';
import { OPPORTUNITY_DIMENSIONS, newOpportunity } from '../../lib/schema';
import { addOpportunity } from '../../store/actions';
import { useStore } from '../../store/store';
import { navigate } from '../../router';

type Filter = 'active' | OpportunityStatus;

export default function OpportunityLab() {
  const { data, update } = useStore();
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');

  const create = () => {
    const opportunity = newOpportunity();
    update(current => addOpportunity(current, opportunity));
    navigate(`#/lab/${opportunity.id}`);
  };

  const options = [
    { value: 'active' as Filter, label: 'All active', count: data.opportunities.filter(item => item.status !== 'archived').length },
    ...OPPORTUNITY_STATUSES.map(status => ({ value: status as Filter, label: OPPORTUNITY_STATUS_LABELS[status], count: data.opportunities.filter(item => item.status === status).length })),
  ];
  const q = query.trim().toLowerCase();
  const items = data.opportunities
    .filter(item => (filter === 'active' ? item.status !== 'archived' : item.status === filter))
    .filter(item => !q || [item.title, item.problem, item.who, item.notes].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <>
      <PageHeader
        eyebrow="Opportunity Lab"
        title="Problems worth noticing"
        lede="Train the founder muscle: observe expensive problems before inventing solutions. Evidence over enthusiasm; no billion-dollar score."
        actions={<Button variant="primary" icon="plus" onClick={create}>New observation</Button>}
      />
      <div className="toolbar">
        <Segmented label="Filter by status" hideLabel value={filter} options={options} onChange={setFilter} />
        <TextField label="Search observations" type="search" value={query} onChange={setQuery} placeholder="Problem, who, notes…" className="toolbar__search" />
      </div>
      {items.length === 0 ? (
        <EmptyState
          title={data.opportunities.length ? 'Nothing matches.' : 'No observations yet.'}
          action={!data.opportunities.length && <Button variant="primary" icon="plus" onClick={create}>Log your first observation</Button>}
        >
          {data.opportunities.length ? 'Try another filter.' : 'Notice one real problem this week: a workaround, a spreadsheet, a complaint. Describe it without a solution.'}
        </EmptyState>
      ) : (
        <ul className="opportunity-grid">
          {items.map(item => <OpportunityCard key={item.id} opportunity={item} />)}
        </ul>
      )}
      <Principle>Problems &gt; technology. Distribution matters.</Principle>
    </>
  );
}

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const scored = OPPORTUNITY_DIMENSIONS.filter(dimension => opportunity.scores[dimension.id].score > 0);
  const interviews = opportunity.evidence.filter(item => item.kind === 'interview').length;
  return (
    <li>
      <a className="opportunity-card" href={`#/lab/${opportunity.id}`}>
        <span className="opportunity-card__top">
          <OpportunityStatusPill status={opportunity.status} />
          <span className="mono muted">{formatRelative(opportunity.updatedAt)}</span>
        </span>
        <span className="opportunity-card__title">{opportunity.title || 'Untitled observation'}</span>
        {opportunity.who && <span className="opportunity-card__who"><span className="mono-label">Who</span> {opportunity.who}</span>}
        <span className="opportunity-card__profile" aria-label={`${scored.length} of 9 dimensions assessed`}>
          {OPPORTUNITY_DIMENSIONS.map(dimension => {
            const score = opportunity.scores[dimension.id].score;
            return (
              <span key={dimension.id} className="profile-bar" title={`${dimension.label}: ${score ? `${score}/5` : 'not assessed'}`}>
                <span className="profile-bar__fill" style={{ height: `${(score / 5) * 100}%` }} />
              </span>
            );
          })}
        </span>
        <span className="opportunity-card__foot mono">
          {opportunity.evidence.length} evidence · {interviews} interview{interviews === 1 ? '' : 's'} · {scored.length}/9 assessed
        </span>
      </a>
    </li>
  );
}
