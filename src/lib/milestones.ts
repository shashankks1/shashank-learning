import type { AppData, Build } from '../types';
import { isMasteryPassed } from './mastery';

export interface MilestoneDefinition {
  id: string;
  title: string;
  /** What counts as evidence — shown so the learner knows the bar. */
  bar: string;
  /** Returns a description of the evidence found in the data, or null. */
  detect?: (data: AppData) => string | null;
}

const done = (build: Build) => build.status === 'completed' || build.status === 'published';
const techIncludes = (build: Build, ...needles: string[]) =>
  build.technology.some(tech => needles.some(needle => tech.toLowerCase().includes(needle)));

function firstBuild(data: AppData, predicate: (build: Build) => boolean): string | null {
  const match = [...data.builds].sort((a, b) => a.date.localeCompare(b.date)).find(predicate);
  return match ? `Build: ${match.name}` : null;
}

export const MILESTONES: MilestoneDefinition[] = [
  {
    id: 'first-webpage',
    title: 'First webpage',
    bar: 'A completed build of a page you wrote yourself.',
    detect: data => firstBuild(data, build => done(build) && (techIncludes(build, 'html') || (build.week ?? 99) <= 4)),
  },
  {
    id: 'first-repo',
    title: 'First GitHub repository',
    bar: 'A build with a GitHub URL.',
    detect: data => firstBuild(data, build => build.githubUrl.includes('github.com')),
  },
  {
    id: 'first-js-app',
    title: 'First JavaScript application',
    bar: 'A completed build using JavaScript with real interaction.',
    detect: data => firstBuild(data, build => done(build) && (techIncludes(build, 'javascript', 'js') || ((build.week ?? 0) >= 5 && (build.week ?? 0) <= 8))),
  },
  {
    id: 'first-react',
    title: 'First React app',
    bar: 'A completed build using React.',
    detect: data => firstBuild(data, build => done(build) && techIncludes(build, 'react', 'next')),
  },
  {
    id: 'first-deployed',
    title: 'First deployed application',
    bar: 'A completed build with a live URL.',
    detect: data => firstBuild(data, build => done(build) && build.liveUrl.startsWith('http')),
  },
  {
    id: 'first-database',
    title: 'First database-backed product',
    bar: 'A completed build in the Databases area, or using Postgres/SQL.',
    detect: data => firstBuild(data, build => done(build) && (build.areas.includes('databases') || techIncludes(build, 'postgres', 'sql', 'supabase', 'sqlite'))),
  },
  {
    id: 'first-auth',
    title: 'First authenticated app',
    bar: 'A completed build with authentication (tag the technology, e.g. "Supabase Auth").',
    detect: data => firstBuild(data, build => done(build) && techIncludes(build, 'auth', 'clerk', 'oauth')),
  },
  {
    id: 'first-ai-feature',
    title: 'First AI feature',
    bar: 'A completed build in the AI Engineering area, or the AI mastery passed.',
    detect: data => firstBuild(data, build => done(build) && build.areas.includes('ai')) ?? (isMasteryPassed(data, 'm10') ? 'Mastery passed: AI feature with evaluation' : null),
  },
  {
    id: 'first-rag',
    title: 'First RAG system',
    bar: 'A completed retrieval build, or the retrieval mastery passed.',
    detect: data => firstBuild(data, build => done(build) && techIncludes(build, 'rag', 'embedding', 'pgvector', 'retrieval')) ?? (isMasteryPassed(data, 'm11') ? 'Mastery passed: retrieval' : null),
  },
  {
    id: 'first-automation',
    title: 'First automation',
    bar: 'A completed build in the Automation area.',
    detect: data => firstBuild(data, build => done(build) && (build.areas.includes('automation') || techIncludes(build, 'n8n', 'webhook', 'zapier', 'make'))),
  },
  {
    id: 'first-interview',
    title: 'First user research interview',
    bar: 'An interview logged as evidence on an opportunity.',
    detect: data => {
      const match = data.opportunities.find(item => item.evidence.some(evidence => evidence.kind === 'interview'));
      return match ? `Interview evidence on “${match.title}”` : null;
    },
  },
  { id: 'first-real-user', title: 'First real user', bar: 'Someone who isn’t you used something you built for a real need. Describe who and what.' },
  {
    id: 'first-launch',
    title: 'First product launch',
    bar: 'The capstone (portfolio slot 5) published, or a launch you describe.',
    detect: data => (data.portfolio[4]?.status === 'published' ? 'Capstone published' : null),
  },
  { id: 'first-paying-customer', title: 'First paying customer', bar: 'Money received for something you built. Record how much and from whom (kept private).' },
  {
    id: 'first-client',
    title: 'First meaningful freelance/client opportunity',
    bar: 'A freelance or client experiment marked as won.',
    detect: data => {
      const match = data.career.experiments.find(item => (item.type === 'freelance' || item.type === 'client') && item.status === 'won');
      return match ? `Won: ${match.title}` : null;
    },
  },
];

export interface MilestoneState {
  definition: MilestoneDefinition;
  achieved: boolean;
  evidence: string | null;
  source: 'detected' | 'claimed' | null;
}

export function milestoneStates(data: AppData): MilestoneState[] {
  return MILESTONES.map(definition => {
    const detected = definition.detect?.(data) ?? null;
    if (detected) return { definition, achieved: true, evidence: detected, source: 'detected' };
    const claim = data.milestones[definition.id];
    if (claim && claim.evidence.trim().length >= 10) return { definition, achieved: true, evidence: claim.evidence, source: 'claimed' };
    return { definition, achieved: false, evidence: null, source: null };
  });
}
