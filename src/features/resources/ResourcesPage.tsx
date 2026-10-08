import { useState } from 'react';
import type { ResourceType } from '../../types';
import { curriculum, getWeek } from '../../curriculum';
import { Icon } from '../../components/Icon';
import { Button, Card, ExternalLink, PageHeader, Segmented, SelectField, TextField } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { nowISO } from '../../lib/dates';
import { isHttpUrl } from '../../lib/format';
import { createId } from '../../lib/id';
import { RESOURCE_TYPE_LABELS } from '../../lib/labels';
import { currentWeekNumber } from '../../lib/progress';
import { addResource, deleteResource } from '../../store/actions';
import { useStore } from '../../store/store';

const TYPES = Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[];

export default function ResourcesPage() {
  const { data, update } = useStore();
  const toast = useToast();
  const current = currentWeekNumber(data);
  const week = getWeek(current)!;
  const [type, setType] = useState<'all' | ResourceType>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState({ title: '', url: '', type: 'docs' as ResourceType, week: String(current), note: '' });

  const q = query.trim().toLowerCase();
  const all = [
    ...curriculum.weeks.flatMap(item => item.resources.map(resource => ({ ...resource, week: item.n, own: false as const, id: `${item.n}-${resource.url}` }))),
    ...data.resources.map(resource => ({ ...resource, own: true as const })),
  ].filter(resource => (type === 'all' || resource.type === type) && (!q || `${resource.title} ${resource.note ?? ''}`.toLowerCase().includes(q)));

  const byWeek = new Map<number | null, typeof all>();
  for (const resource of all) {
    const key = resource.week ?? null;
    byWeek.set(key, [...(byWeek.get(key) ?? []), resource]);
  }

  const save = () => {
    if (!draft.title.trim() || !isHttpUrl(draft.url.trim())) return;
    update(currentData => addResource(currentData, { id: createId('r'), title: draft.title.trim(), url: draft.url.trim(), type: draft.type, week: draft.week ? Number(draft.week) : null, note: draft.note.trim(), createdAt: nowISO() }));
    setDraft({ ...draft, title: '', url: '', note: '' });
    toast('Resource added', 'success');
  };

  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="References that unblock the build"
        lede="Not a library to consume. Official documentation first, then good references, then project-based practice. Open one when the build needs it."
      />

      <Card label={`For this week · Week ${current}: ${week.title}`} className="resources-now">
        <ul className="resource-list resource-list--wide">
          {week.resources.map(resource => (
            <li key={resource.url}>
              <ExternalLink href={resource.url}>{resource.title}</ExternalLink>
              <span className="resource-list__type">{RESOURCE_TYPE_LABELS[resource.type]}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="toolbar">
        <Segmented label="Type" hideLabel value={type} onChange={setType} options={[{ value: 'all' as const, label: 'All' }, ...TYPES.map(value => ({ value, label: RESOURCE_TYPE_LABELS[value] }))]} />
        <TextField label="Search resources" type="search" value={query} onChange={setQuery} className="toolbar__search" />
      </div>

      <div className="resources-layout">
        <div className="resources-index">
          {[...byWeek.entries()]
            .sort(([a], [b]) => (a ?? 999) - (b ?? 999))
            .map(([weekNumber, resources]) => (
              <section key={weekNumber ?? 'none'} className="resources-week">
                <h2 className="mono-label">{weekNumber ? `Week ${weekNumber} · ${getWeek(weekNumber)?.title}` : 'Not tied to a week'}</h2>
                <ul className="resource-list resource-list--wide">
                  {resources.map(resource => (
                    <li key={resource.id}>
                      <ExternalLink href={resource.url}>{resource.title}</ExternalLink>
                      <span className="resource-list__type">{resource.own ? 'Yours · ' : ''}{RESOURCE_TYPE_LABELS[resource.type]}</span>
                      {resource.own && (
                        <button type="button" className="icon-btn icon-btn--sm" aria-label={`Remove ${resource.title}`} onClick={() => update(currentData => deleteResource(currentData, resource.id))}>
                          <Icon name="trash" size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>

        <Card label="Add a resource" className="resources-add">
          <TextField label="Title" value={draft.title} onChange={title => setDraft({ ...draft, title })} />
          <TextField label="URL" type="url" value={draft.url} onChange={url => setDraft({ ...draft, url })} hint={draft.url && !isHttpUrl(draft.url.trim()) ? 'Needs to start with https://' : undefined} />
          <SelectField<ResourceType> label="Type" value={draft.type} onChange={value => setDraft({ ...draft, type: value })} options={TYPES.map(value => ({ value, label: RESOURCE_TYPE_LABELS[value] }))} />
          <SelectField label="For week" value={draft.week} onChange={value => setDraft({ ...draft, week: value })} options={[{ value: '', label: 'Any week' }, ...curriculum.weeks.map(item => ({ value: String(item.n), label: `Week ${item.n} · ${item.title}` }))]} />
          <TextField label="Why it helps" value={draft.note} onChange={note => setDraft({ ...draft, note })} />
          <Button variant="primary" icon="plus" onClick={save} disabled={!draft.title.trim() || !isHttpUrl(draft.url.trim())}>Add</Button>
        </Card>
      </div>
    </>
  );
}
