import type { PortfolioSlot, PortfolioStatus } from '../../types';
import { curriculum } from '../../curriculum';
import { PortfolioStatusPill } from '../../components/domain';
import { Button, Card, EmptyState, ExternalLink, LinkButton, PageHeader, SelectField, TextArea, TextField } from '../../components/ui';
import { isHttpUrl } from '../../lib/format';
import { PORTFOLIO_STATUS_LABELS } from '../../lib/labels';
import { updatePortfolioSlot } from '../../store/actions';
import { useStore } from '../../store/store';

const STATUS_OPTIONS = (Object.keys(PORTFOLIO_STATUS_LABELS) as PortfolioStatus[]).map(value => ({ value, label: PORTFOLIO_STATUS_LABELS[value] }));

export default function PortfolioSlotPage({ slot: slotNumber }: { slot: number }) {
  const { data, update } = useStore();
  const definition = curriculum.portfolioSlots.find(item => item.slot === slotNumber);
  const slot = data.portfolio.find(item => item.slot === slotNumber);
  if (!definition || !slot) return <EmptyState title="Portfolio slot not found" action={<LinkButton href="#/portfolio">Portfolio</LinkButton>} />;

  const patch = (change: Partial<PortfolioSlot>) => update(current => updatePortfolioSlot(current, slotNumber, change));
  const field = (key: keyof PortfolioSlot) => (value: string) => patch({ [key]: value } as Partial<PortfolioSlot>);
  const candidates = data.builds.filter(build => build.portfolioCandidate || build.id === slot.buildId);
  const linked = data.builds.find(build => build.id === slot.buildId);
  const publishProblems = [
    !slot.project && 'a project name',
    !isHttpUrl(slot.live) && !isHttpUrl(slot.github) && 'a live or GitHub link',
    !slot.caseStudy.trim() && 'a case study',
  ].filter(Boolean) as string[];

  const prefillFromBuild = () => {
    if (!linked) return;
    patch({
      project: slot.project || linked.name,
      problem: slot.problem || linked.problem,
      technology: slot.technology || linked.technology.join(', '),
      github: slot.github || linked.githubUrl,
      live: slot.live || linked.liveUrl,
      result: slot.result || linked.learned,
    });
  };

  return (
    <article className="detail">
      <PageHeader
        eyebrow={`Portfolio proof ${slotNumber} of 5 · ${definition.theme}`}
        title={slot.project || definition.theme}
        lede={definition.intent}
        actions={<PortfolioStatusPill status={slot.status} />}
      />
      <div className="detail__layout">
        <div className="detail__main">
          <Card label="The project">
            <div className="form-grid form-grid--2">
              <TextField label="Project" value={slot.project} onChange={field('project')} />
              <SelectField
                label="Built from"
                value={slot.buildId ?? ''}
                onChange={value => patch({ buildId: value || null })}
                options={[{ value: '', label: 'Not linked to a build' }, ...candidates.map(build => ({ value: build.id, label: build.name }))]}
                hint={candidates.length ? undefined : 'Mark builds as portfolio candidates to see them here.'}
              />
            </div>
            {linked && <Button size="sm" onClick={prefillFromBuild}>Fill empty fields from “{linked.name}”</Button>}
            <TextArea label="Capability demonstrated" value={slot.capability} onChange={field('capability')} rows={2} />
            <TextArea label="Problem solved" value={slot.problem} onChange={field('problem')} rows={2} />
            <div className="form-grid form-grid--2">
              <TextField label="Your role" value={slot.role} onChange={field('role')} placeholder="Solo designer + developer" />
              <TextField label="Technology" value={slot.technology} onChange={field('technology')} />
            </div>
          </Card>
          <Card label="Decisions">
            <TextArea label="Design decisions" value={slot.designDecisions} onChange={field('designDecisions')} rows={3} />
            <TextArea label="Technical decisions" value={slot.technicalDecisions} onChange={field('technicalDecisions')} rows={3} />
            <TextArea label="Result" value={slot.result} onChange={field('result')} rows={2} hint="What changed because this exists? Numbers if you have them, honesty if you don’t." />
          </Card>
          <Card label="Links & case study">
            <div className="form-grid form-grid--2">
              <TextField label="GitHub" type="url" value={slot.github} onChange={value => patch({ github: value.trim() })} />
              <TextField label="Live demo" type="url" value={slot.live} onChange={value => patch({ live: value.trim() })} />
            </div>
            <div className="link-row">
              {isHttpUrl(slot.github) && <ExternalLink href={slot.github}>Repository</ExternalLink>}
              {isHttpUrl(slot.live) && <ExternalLink href={slot.live}>Live demo</ExternalLink>}
            </div>
            <TextArea label="Case study (link or draft)" value={slot.caseStudy} onChange={field('caseStudy')} rows={5} hint="Problem → evidence → decisions → build → result → what failed." />
          </Card>
        </div>
        <aside className="detail__side">
          <Card label="Status">
            <SelectField<PortfolioStatus> label="Status" value={slot.status} onChange={status => patch({ status })} options={STATUS_OPTIONS} />
            {slot.status === 'published' && publishProblems.length > 0 && (
              <p className="warn-text">Marked published but missing {publishProblems.join(', ')}. Published means someone else can open it.</p>
            )}
          </Card>
          <Card label="The ladder">
            <ol className="plain-list numbered">
              {curriculum.portfolioSlots.map(item => (
                <li key={item.slot} className={item.slot === slotNumber ? 'is-current' : ''}>
                  <a href={`#/portfolio/${item.slot}`}>{item.theme}</a>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </article>
  );
}
