import { useState } from 'react';
import type { BuildStatus } from '../../types';
import { BuildStatusPill, Thumbnail, dependencyRisk } from '../../components/domain';
import { Icon } from '../../components/Icon';
import { Button, EmptyState, PageHeader, Segmented, TextField } from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { BUILD_STATUSES, BUILD_STATUS_LABELS } from '../../lib/labels';
import { currentWeekNumber } from '../../lib/progress';
import { useStore } from '../../store/store';
import { useCreateBuild } from './useCreateBuild';

type Filter = 'all' | BuildStatus;

export default function BuildsPage() {
  const { data } = useStore();
  const createBuild = useCreateBuild();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const counts = Object.fromEntries(BUILD_STATUSES.map(status => [status, data.builds.filter(build => build.status === status).length]));
  const filters = [
    { value: 'all' as Filter, label: 'All', count: data.builds.length },
    ...BUILD_STATUSES.map(status => ({ value: status as Filter, label: BUILD_STATUS_LABELS[status], count: counts[status] })),
  ];
  const q = query.trim().toLowerCase();
  const builds = [...data.builds]
    .filter(build => filter === 'all' || build.status === filter)
    .filter(build => !q || [build.name, build.objective, build.problem, ...build.technology].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <>
      <PageHeader
        eyebrow="Builds"
        title="Projects and technical proofs"
        lede="Learning becomes capability only when it turns into something that runs. Record what broke as carefully as what worked."
        actions={<Button variant="primary" icon="plus" onClick={() => createBuild({ week: currentWeekNumber(data) })}>New build</Button>}
      />
      <div className="toolbar">
        <Segmented label="Filter by status" hideLabel value={filter} options={filters} onChange={setFilter} />
        <TextField label="Search builds" type="search" value={query} onChange={setQuery} placeholder="Name, tech, problem…" className="toolbar__search" />
      </div>
      {builds.length === 0 ? (
        <EmptyState
          title={data.builds.length ? 'No builds match.' : 'No builds yet.'}
          action={!data.builds.length && <Button variant="primary" icon="plus" onClick={() => createBuild({ week: currentWeekNumber(data) })}>Start this week’s build</Button>}
        >
          {data.builds.length ? 'Try another filter or search.' : 'Each curriculum week has a build. Start with this week’s.'}
        </EmptyState>
      ) : (
        <ul className="build-grid">
          {builds.map(build => {
            const risk = dependencyRisk(build.ai);
            return (
              <li key={build.id}>
                <a className="build-card" href={`#/builds/${build.id}`}>
                  <Thumbnail imageId={build.screenshotId} alt={`${build.name} screenshot`} />
                  <span className="build-card__body">
                    <span className="build-card__top">
                      <BuildStatusPill status={build.status} />
                      {build.week && <span className="mono-label">W{build.week}</span>}
                    </span>
                    <span className="build-card__title">{build.name}</span>
                    {build.objective && <span className="build-card__objective">{build.objective}</span>}
                    <span className="build-card__meta">
                      {build.technology.slice(0, 4).map(tech => <span key={tech} className="chip chip--static">{tech}</span>)}
                    </span>
                    <span className="build-card__foot">
                      <span className="mono">{formatDate(build.date)}</span>
                      {build.githubUrl && <span title="Has a repository"><Icon name="github" size={15} /><span className="visually-hidden">Repository</span></span>}
                      {build.liveUrl && <span title="Has a live URL"><Icon name="globe" size={15} /><span className="visually-hidden">Live</span></span>}
                      {build.portfolioCandidate && <span className="mono-label">Portfolio candidate</span>}
                      {(risk === 'medium' || risk === 'high') && <span className="mono-label warn-text">AI dependency: {risk}</span>}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
