import { useMemo, useState } from 'react';
import { Button, EmptyState, PageHeader, Principle, SelectField, TextField } from '../../components/ui';
import { dependencyRisk } from '../../components/domain';
import { formatDateLong } from '../../lib/dates';
import { newLogEntry } from '../../lib/schema';
import { currentWeekNumber } from '../../lib/progress';
import { addLogEntry } from '../../store/actions';
import { useStore } from '../../store/store';
import { navigate } from '../../router';
import { useUi } from '../shell/ui-context';

export default function BuildLogPage() {
  const { data, update } = useStore();
  const ui = useUi();
  const [query, setQuery] = useState('');
  const [buildFilter, setBuildFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [brokeOnly, setBrokeOnly] = useState(false);

  const tags = useMemo(() => [...new Set(data.buildLog.flatMap(entry => entry.tags))].sort(), [data.buildLog]);
  const q = query.trim().toLowerCase();
  const entries = [...data.buildLog]
    .filter(entry => !buildFilter || entry.buildId === buildFilter)
    .filter(entry => !tagFilter || entry.tags.includes(tagFilter))
    .filter(entry => !brokeOnly || entry.broke.trim())
    .filter(entry => !q || [entry.tried, entry.happened, entry.broke, entry.why, entry.learned, entry.changed, entry.next, ...entry.tags].join(' ').toLowerCase().includes(q))
    .sort((a, b) => (b.date === a.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));

  const create = () => {
    const entry = newLogEntry({ week: currentWeekNumber(data) });
    update(current => addLogEntry(current, entry));
    navigate(`#/log/${entry.id}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Build Log"
        title="Engineering journal"
        lede="What you tried, what happened, what broke and why. The failures are the curriculum; record them as carefully as the wins."
        actions={
          <>
            <Button icon="bug" onClick={() => ui.openDebug()}>Debug mode</Button>
            <Button variant="primary" icon="plus" onClick={create}>New entry</Button>
          </>
        }
      />
      <div className="toolbar toolbar--wrap">
        <TextField label="Search the log" type="search" value={query} onChange={setQuery} placeholder="Error message, concept, tool…" className="toolbar__search" />
        <SelectField label="Build" value={buildFilter} onChange={setBuildFilter} options={[{ value: '', label: 'All builds' }, ...data.builds.map(build => ({ value: build.id, label: build.name }))]} />
        <SelectField label="Tag" value={tagFilter} onChange={setTagFilter} options={[{ value: '', label: 'All tags' }, ...tags.map(tag => ({ value: tag, label: tag }))]} />
        <label className="toggle">
          <input type="checkbox" checked={brokeOnly} onChange={event => setBrokeOnly(event.target.checked)} />
          <span>Only entries where something broke</span>
        </label>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title={data.buildLog.length ? 'No entries match.' : 'The log is empty.'}
          action={!data.buildLog.length && <Button variant="primary" icon="plus" onClick={create}>Write the first entry</Button>}
        >
          {data.buildLog.length ? 'Clear a filter or try other words.' : 'Next time something breaks, that’s an entry. So is the next time something surprises you.'}
        </EmptyState>
      ) : (
        <ol className="log-list">
          {entries.map(entry => {
            const build = data.builds.find(item => item.id === entry.buildId);
            const risk = dependencyRisk(entry.ai);
            return (
              <li key={entry.id}>
                <a className="log-entry" href={`#/log/${entry.id}`}>
                  <span className="log-entry__meta">
                    <span className="mono">{formatDateLong(entry.date)}</span>
                    {entry.week && <span className="mono-label">W{entry.week}</span>}
                    {build && <span className="mono-label">{build.name}</span>}
                    {entry.tags.map(tag => <span key={tag} className="chip chip--static">{tag}</span>)}
                    {(risk === 'medium' || risk === 'high') && <span className="mono-label warn-text">AI dependency: {risk}</span>}
                  </span>
                  <span className="log-entry__title">{entry.tried || 'Untitled entry'}</span>
                  <span className="log-entry__grid">
                    {entry.broke && <span><span className="mono-label">Broke</span> {entry.broke}</span>}
                    {entry.why && <span><span className="mono-label">Why</span> {entry.why}</span>}
                    {entry.learned && <span><span className="mono-label">Learned</span> {entry.learned}</span>}
                    {entry.next && <span><span className="mono-label">Next</span> {entry.next}</span>}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
      <Principle>Debug &gt; avoid mistakes. Understand &gt; memorize.</Principle>
    </>
  );
}
