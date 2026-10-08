import { useState } from 'react';
import type { BuildLogEntry } from '../../types';
import { curriculum } from '../../curriculum';
import { AiAssistFields } from '../../components/domain';
import { Button, Card, ConfirmDialog, EmptyState, LinkButton, PageHeader, SelectField, TagInput, TextArea, TextField } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { deleteLogEntry, updateLogEntry } from '../../store/actions';
import { useStore } from '../../store/store';
import { navigate } from '../../router';

const FIELDS: { key: keyof BuildLogEntry; label: string; hint?: string }[] = [
  { key: 'tried', label: 'What I tried' },
  { key: 'happened', label: 'What happened' },
  { key: 'broke', label: 'What broke', hint: 'The symptom, exactly. Paste the error message.' },
  { key: 'why', label: 'Why it broke', hint: 'The root cause, not the patch. “I don’t know yet” is honest.' },
  { key: 'learned', label: 'What I learned' },
  { key: 'changed', label: 'What I changed' },
  { key: 'next', label: 'What I will try next' },
];

export default function LogEntryPage({ id }: { id: string }) {
  const { data, update } = useStore();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const entry = data.buildLog.find(item => item.id === id);
  if (!entry) return <EmptyState title="Entry not found" action={<LinkButton href="#/log">Build Log</LinkButton>} />;

  const patch = (change: Partial<BuildLogEntry>) => update(current => updateLogEntry(current, id, change));

  return (
    <article className="detail">
      <PageHeader eyebrow="Build Log entry" title={entry.tried || 'New entry'} actions={<LinkButton href="#/log" variant="ghost" icon="chevronLeft">All entries</LinkButton>} />
      <div className="detail__layout">
        <div className="detail__main">
          <Card>
            <div className="form-grid form-grid--3">
              <TextField label="Date" type="date" value={entry.date} onChange={date => patch({ date })} />
              <SelectField label="Build" value={entry.buildId ?? ''} onChange={value => patch({ buildId: value || null })} options={[{ value: '', label: 'None' }, ...data.builds.map(build => ({ value: build.id, label: build.name }))]} />
              <SelectField
                label="Week"
                value={entry.week ? String(entry.week) : ''}
                onChange={value => patch({ week: value ? Number(value) : null })}
                options={[{ value: '', label: 'None' }, ...curriculum.weeks.map(week => ({ value: String(week.n), label: `Week ${week.n} · ${week.title}` }))]}
              />
            </div>
            {FIELDS.map(field => (
              <TextArea
                key={field.key}
                label={field.label}
                hint={field.hint}
                value={String(entry[field.key] ?? '')}
                onChange={value => patch({ [field.key]: value } as Partial<BuildLogEntry>)}
                rows={2}
                autoFocus={field.key === 'tried' && !entry.tried}
              />
            ))}
            <TagInput label="Tags" value={entry.tags} onChange={tags => patch({ tags })} placeholder="css, git, async…" />
          </Card>
          <Card label="AI leverage, without losing agency">
            <AiAssistFields value={entry.ai} onChange={ai => patch({ ai })} />
          </Card>
        </div>
        <aside className="detail__side">
          <Card label="Saved automatically">
            <p className="card__note">Every field saves as you type.</p>
            <Button variant="danger" size="sm" icon="trash" onClick={() => setConfirmDelete(true)}>Delete entry</Button>
          </Card>
        </aside>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this entry?"
          body={<p>Even messy entries are useful later. Delete only if it’s a duplicate or empty.</p>}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            update(current => deleteLogEntry(current, id));
            toast('Entry deleted');
            navigate('#/log');
          }}
        />
      )}
    </article>
  );
}
