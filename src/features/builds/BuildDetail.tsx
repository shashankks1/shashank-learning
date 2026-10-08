import { useState } from 'react';
import type { Build, BuildStatus } from '../../types';
import { curriculum } from '../../curriculum';
import { AiAssistFields, BuildStatusPill, ImageField } from '../../components/domain';
import { Button, Card, Checkbox, ConfirmDialog, EmptyState, ExternalLink, LinkButton, PageHeader, SelectField, TagInput, TextArea, TextField } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { formatDateLong, formatMinutes } from '../../lib/dates';
import { isHttpUrl } from '../../lib/format';
import { BUILD_STATUSES, BUILD_STATUS_LABELS } from '../../lib/labels';
import { deleteBuild, updateBuild } from '../../store/actions';
import { useStore } from '../../store/store';
import { navigate } from '../../router';
import { useUi } from '../shell/ui-context';
import type { CapabilityId } from '../../types';

export default function BuildDetail({ id }: { id: string }) {
  const { data, update, images } = useStore();
  const ui = useUi();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const build = data.builds.find(item => item.id === id);

  if (!build) {
    return <EmptyState title="Build not found" action={<LinkButton href="#/builds">All builds</LinkButton>}>It may have been deleted.</EmptyState>;
  }

  const patch = (change: Partial<Build>) => update(current => updateBuild(current, id, change));
  const logs = data.buildLog.filter(entry => entry.buildId === id);
  const minutes = data.sessions.filter(session => session.buildId === id).reduce((sum, session) => sum + session.minutes, 0);
  const portfolioSlot = data.portfolio.find(slot => slot.buildId === id);
  const urlProblem = (value: string) => (value && !isHttpUrl(value) ? 'Should start with https://' : undefined);

  const toggleArea = (area: CapabilityId) =>
    patch({ areas: build.areas.includes(area) ? build.areas.filter(item => item !== area) : [...build.areas, area] });

  return (
    <article className="detail">
      <PageHeader
        eyebrow={`Build${build.week ? ` · Week ${build.week}` : ''} · started ${formatDateLong(build.date)}`}
        title={build.name || 'Untitled build'}
        lede={<span className="pill-row"><BuildStatusPill status={build.status} /> <span className="mono">{formatMinutes(minutes)} logged · {logs.length} log entr{logs.length === 1 ? 'y' : 'ies'}</span></span>}
        actions={
          <>
            <Button icon="play" onClick={() => ui.openStartSession({ week: build.week, buildId: build.id })}>Work on it</Button>
            <Button icon="bug" onClick={() => ui.openDebug({ buildId: build.id, week: build.week })}>Debug mode</Button>
          </>
        }
      />

      <div className="detail__layout">
        <div className="detail__main">
          <Card label="Definition">
            <div className="form-grid form-grid--2">
              <TextField label="Name" value={build.name} onChange={name => patch({ name })} />
              <SelectField<BuildStatus>
                label="Status"
                value={build.status}
                onChange={status => patch({ status })}
                options={BUILD_STATUSES.map(status => ({ value: status, label: BUILD_STATUS_LABELS[status] }))}
                hint={build.status === 'published' && !build.liveUrl ? 'Published usually means a live URL. Add one below.' : undefined}
              />
              <TextField label="Date started" type="date" value={build.date} onChange={date => patch({ date })} />
              <SelectField
                label="Curriculum week"
                value={build.week ? String(build.week) : ''}
                onChange={value => patch({ week: value ? Number(value) : null })}
                options={[{ value: '', label: 'Not tied to a week' }, ...curriculum.weeks.map(week => ({ value: String(week.n), label: `Week ${week.n} · ${week.title}` }))]}
              />
            </div>
            <TagInput label="Technology" value={build.technology} onChange={technology => patch({ technology })} placeholder="Type and press Enter: HTML, React, Postgres…" />
            <fieldset className="area-picker">
              <legend className="mono-label">Capability areas this build proves</legend>
              <div className="area-picker__options">
                {curriculum.capabilityAreas.map(area => (
                  <Checkbox key={area.id} checked={build.areas.includes(area.id)} onChange={() => toggleArea(area.id)}>{area.label}</Checkbox>
                ))}
              </div>
            </fieldset>
            <TextArea label="Objective: what should it do?" value={build.objective} onChange={objective => patch({ objective })} rows={2} />
            <TextArea label="Problem: whose problem does it solve?" value={build.problem} onChange={problem => patch({ problem })} rows={2} />
          </Card>

          <Card label="Evidence">
            <div className="form-grid form-grid--2">
              <TextField label="GitHub URL" type="url" value={build.githubUrl} onChange={githubUrl => patch({ githubUrl: githubUrl.trim() })} placeholder="https://github.com/…" hint={urlProblem(build.githubUrl)} />
              <TextField label="Live URL" type="url" value={build.liveUrl} onChange={liveUrl => patch({ liveUrl: liveUrl.trim() })} placeholder="https://…" hint={urlProblem(build.liveUrl)} />
            </div>
            <div className="link-row">
              {isHttpUrl(build.githubUrl) && <ExternalLink href={build.githubUrl}>Open repository</ExternalLink>}
              {isHttpUrl(build.liveUrl) && <ExternalLink href={build.liveUrl}>Open live site</ExternalLink>}
            </div>
            <ImageField label="Screenshot" imageId={build.screenshotId} onChange={screenshotId => patch({ screenshotId })} />
          </Card>

          <Card label="What happened">
            <TextArea label="What I learned" value={build.learned} onChange={learned => patch({ learned })} rows={3} />
            <TextArea label="What broke" value={build.broke} onChange={broke => patch({ broke })} rows={3} hint="The most valuable field on this page. Future you will search it." />
            <TextArea label="What I would improve" value={build.improve} onChange={improve => patch({ improve })} rows={2} />
          </Card>

          <Card label="AI leverage, without losing agency">
            <AiAssistFields value={build.ai} onChange={ai => patch({ ai })} />
          </Card>
        </div>

        <aside className="detail__side">
          <Card label="Portfolio">
            <Checkbox checked={build.portfolioCandidate} onChange={portfolioCandidate => patch({ portfolioCandidate })}>Portfolio candidate</Checkbox>
            {portfolioSlot ? (
              <p className="card__note">In portfolio proof <a href={`#/portfolio/${portfolioSlot.slot}`}>slot {portfolioSlot.slot}</a>.</p>
            ) : (
              build.portfolioCandidate && <LinkButton href="#/portfolio" size="sm">Place it in a proof slot</LinkButton>
            )}
          </Card>
          <Card label="Build log for this project">
            {logs.length ? (
              <ul className="plain-list">
                {logs.slice(-5).reverse().map(entry => (
                  <li key={entry.id}><a href={`#/log/${entry.id}`}>{entry.tried || 'Entry'}</a> <span className="muted mono">{entry.date}</span></li>
                ))}
              </ul>
            ) : (
              <p className="card__note">No entries yet. Log the next thing that breaks.</p>
            )}
            <LinkButton href="#/log" size="sm" variant="ghost">Build Log</LinkButton>
          </Card>
          <Card label="Danger zone">
            <Button variant="danger" icon="trash" size="sm" onClick={() => setConfirmDelete(true)}>Delete build</Button>
          </Card>
        </aside>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete “${build.name}”?`}
          body={<p>The build and its screenshot are removed. Weeks, log entries and portfolio slots that pointed to it are kept but unlinked. This can’t be undone, except from a backup.</p>}
          confirmLabel="Delete build"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            if (build.screenshotId) await images.remove(build.screenshotId);
            update(current => deleteBuild(current, id));
            toast('Build deleted');
            navigate('#/builds');
          }}
        />
      )}
    </article>
  );
}
