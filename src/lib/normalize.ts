import {
  SCHEMA_VERSION,
  type Activity,
  type AppData,
  type BuildStatus,
  type CareerExperiment,
  type ExperimentStatus,
  type ExperimentType,
  type IncomeRecord,
  type MasteryState,
  type MilestoneClaim,
  type OpportunityEvidence,
  type OpportunityStatus,
  type PortfolioStatus,
  type ResourceType,
  type Session,
  type UserResource,
  type WeekProgress,
} from '../types';
import {
  ACTIVITY_TYPES,
  createEmptyData,
  emptyPortfolio,
  emptyWeek,
  newBuild,
  newLogEntry,
  newMasteryProgress,
  newOpportunity,
} from './schema';

/** A problem with data that the user should hear about in plain language. */
export class DataError extends Error {}

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Copy fields from `raw` onto `defaults` only where the type matches the default.
 * Unknown fields are dropped; missing or mistyped fields fall back to the default.
 */
export function pick<T extends object>(defaults: T, raw: unknown): T {
  if (!isRecord(raw)) return defaults;
  const out: UnknownRecord = { ...(defaults as UnknownRecord) };
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = raw[key];
    if (value === undefined) continue;
    if (fallback === null) {
      if (value === null || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) out[key] = value;
    } else if (Array.isArray(fallback)) {
      if (Array.isArray(value)) out[key] = value;
    } else if (typeof fallback === 'object') {
      if (!isRecord(value)) continue;
      // An empty default object is a free-form record (e.g. reflection answers): keep it as given.
      out[key] = Object.keys(fallback).length === 0 ? { ...value } : pick(fallback as object, value);
    } else if (typeof fallback === 'number') {
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    } else if (typeof value === typeof fallback) {
      out[key] = value;
    }
  }
  return out as T;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function records(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function hasStringId(item: UnknownRecord): boolean {
  return typeof item.id === 'string' && item.id.length > 0;
}

const BUILD_STATUSES: BuildStatus[] = ['idea', 'planned', 'building', 'blocked', 'completed', 'published'];
const MASTERY_STATES: MasteryState[] = ['not-started', 'learning', 'practicing', 'building', 'ready', 'passed', 'needs-review'];
const OPPORTUNITY_STATUSES: OpportunityStatus[] = ['new', 'investigating', 'validating', 'promising', 'archived'];
const PORTFOLIO_STATUSES: PortfolioStatus[] = ['not-started', 'building', 'complete', 'published'];
const EXPERIMENT_TYPES: ExperimentType[] = ['application', 'freelance', 'networking', 'interview', 'client', 'product'];
const EXPERIMENT_STATUSES: ExperimentStatus[] = ['planned', 'active', 'waiting', 'won', 'lost', 'closed'];
const RESOURCE_TYPES: ResourceType[] = ['docs', 'tutorial', 'article', 'video', 'book', 'practice'];
const EVIDENCE_KINDS: OpportunityEvidence['kind'][] = ['interview', 'observation', 'data', 'article', 'other'];

export interface NormalizeResult {
  data: AppData;
  warnings: string[];
}

/** Turn anything that claims to be current-schema data into valid AppData, or explain why not. */
export function normalizeAppData(raw: unknown): NormalizeResult {
  if (!isRecord(raw)) throw new DataError('This is not Level 1 data.');
  const version = raw.schemaVersion;
  if (typeof version !== 'number') throw new DataError('The data has no schema version.');
  if (version > SCHEMA_VERSION) {
    throw new DataError(`This data was made by a newer version of Level 1 (schema ${version}). Update the app first.`);
  }

  const warnings: string[] = [];
  const dropped = (label: string, before: number, after: number) => {
    if (before !== after) warnings.push(`${before - after} invalid ${label} skipped.`);
  };

  const base = createEmptyData();
  const data = pick(base, raw);
  data.schemaVersion = SCHEMA_VERSION;
  data.user.technicalLevel = oneOf(data.user.technicalLevel, ['new', 'some-code', 'shipped-small', 'comfortable'], 'some-code');
  data.settings.theme = oneOf(data.settings.theme, ['system', 'light', 'dark'], 'system');
  data.settings.dismissed = strings(data.settings.dismissed);
  data.curriculum.rebases = records(data.curriculum.rebases)
    .filter(hasStringId)
    .map(item => ({ id: item.id as string, at: String(item.at ?? ''), fromWeek: Number(item.fromWeek) || 1, shiftWeeks: Number(item.shiftWeeks) || 0, reason: String(item.reason ?? '') }));

  data.weeks = normalizeWeeks(raw.weeks);

  const rawActivities = records(raw.activities);
  data.activities = rawActivities
    .filter(item => hasStringId(item) && typeof item.at === 'string' && ACTIVITY_TYPES.includes(item.type as Activity['type']))
    .map(item => pick<Activity>({ id: '', type: 'lesson', at: '', label: '', ref: '' }, item));
  dropped('activities', rawActivities.length, data.activities.length);

  const rawSessions = records(raw.sessions);
  data.sessions = rawSessions
    .filter(item => hasStringId(item) && typeof item.start === 'string' && typeof item.minutes === 'number')
    .map(item => {
      const session = pick<Session>({ id: '', start: '', end: '', minutes: 0, type: 'learn', week: null, buildId: null, note: '' }, item);
      session.type = oneOf(session.type, ['learn', 'practice', 'build', 'mastery', 'research', 'review'], 'learn');
      return session;
    });
  dropped('sessions', rawSessions.length, data.sessions.length);

  data.activeSession = isRecord(raw.activeSession) && typeof raw.activeSession.start === 'string'
    ? pick({ start: '', type: 'learn' as Session['type'], week: null as number | null, buildId: null as string | null }, raw.activeSession)
    : null;

  const rawBuilds = records(raw.builds);
  data.builds = rawBuilds.filter(hasStringId).map(item => {
    const build = pick(newBuild(), item);
    build.status = oneOf(build.status, BUILD_STATUSES, 'idea');
    build.technology = strings(build.technology);
    build.areas = strings(build.areas) as typeof build.areas;
    return build;
  });
  dropped('builds', rawBuilds.length, data.builds.length);

  const rawMastery = records(raw.mastery);
  data.mastery = rawMastery.filter(hasStringId).map(item => {
    const progress = pick(newMasteryProgress(item.id as string), item);
    progress.state = oneOf(progress.state, MASTERY_STATES, 'not-started');
    progress.criteria = Array.isArray(progress.criteria) ? progress.criteria.filter(n => Number.isInteger(n)) : [];
    progress.attempts = records(progress.attempts).filter(hasStringId).map(attempt => ({
      id: attempt.id as string,
      at: String(attempt.at ?? ''),
      result: oneOf(attempt.result, ['passed', 'not-yet', 'reverified'], 'not-yet'),
      note: String(attempt.note ?? ''),
    }));
    return progress;
  });
  dropped('mastery records', rawMastery.length, data.mastery.length);

  const rawOpportunities = records(raw.opportunities);
  data.opportunities = rawOpportunities.filter(hasStringId).map(item => {
    const opportunity = pick(newOpportunity(), item);
    opportunity.status = oneOf(opportunity.status, OPPORTUNITY_STATUSES, 'new');
    opportunity.evidence = records(opportunity.evidence).filter(hasStringId).map(evidence => {
      const normalized = pick<OpportunityEvidence>({ id: '', date: '', kind: 'observation', summary: '', source: '' }, evidence);
      normalized.kind = oneOf(normalized.kind, EVIDENCE_KINDS, 'other');
      return normalized;
    });
    for (const score of Object.values(opportunity.scores)) {
      score.score = Math.max(0, Math.min(5, Math.round(score.score)));
    }
    return opportunity;
  });
  dropped('opportunities', rawOpportunities.length, data.opportunities.length);

  const rawPortfolio = records(raw.portfolio);
  data.portfolio = emptyPortfolio().map(slot => {
    const match = rawPortfolio.find(item => item.slot === slot.slot);
    const normalized = pick(slot, match);
    normalized.slot = slot.slot;
    normalized.status = oneOf(normalized.status, PORTFOLIO_STATUSES, 'not-started');
    return normalized;
  });

  const rawLog = records(raw.buildLog);
  data.buildLog = rawLog.filter(hasStringId).map(item => {
    const entry = pick(newLogEntry(), item);
    entry.tags = strings(entry.tags);
    return entry;
  });
  dropped('build log entries', rawLog.length, data.buildLog.length);

  data.career.stage = Math.max(1, Math.min(9, Math.round(data.career.stage)));
  data.career.experiments = records(data.career.experiments).filter(hasStringId).map(item => {
    const experiment = pick<CareerExperiment>(
      { id: '', type: 'application', title: '', org: '', date: '', status: 'planned', outcome: '', notes: '', amount: null },
      item,
    );
    experiment.type = oneOf(experiment.type, EXPERIMENT_TYPES, 'application');
    experiment.status = oneOf(experiment.status, EXPERIMENT_STATUSES, 'planned');
    return experiment;
  });
  data.career.incomeHistory = records(data.career.incomeHistory)
    .filter(item => hasStringId(item) && typeof item.amount === 'number')
    .map(item => pick<IncomeRecord>({ id: '', date: '', amount: 0, note: '' }, item));

  data.resources = records(raw.resources).filter(hasStringId).map(item => {
    const resource = pick<UserResource>({ id: '', title: '', url: '', type: 'docs', week: null, note: '', createdAt: '' }, item);
    resource.type = oneOf(resource.type, RESOURCE_TYPES, 'docs');
    return resource;
  });

  data.milestones = {};
  if (isRecord(raw.milestones)) {
    for (const [key, value] of Object.entries(raw.milestones)) {
      if (isRecord(value) && typeof value.evidence === 'string') {
        data.milestones[key] = pick<MilestoneClaim>({ evidence: '', at: '' }, value);
      }
    }
  }

  return { data, warnings };
}

function normalizeWeeks(raw: unknown): Record<number, WeekProgress> {
  const weeks: Record<number, WeekProgress> = {};
  if (!isRecord(raw)) return weeks;
  for (const [key, value] of Object.entries(raw)) {
    const n = Number(key);
    if (!Number.isInteger(n) || n < 1 || n > 60 || !isRecord(value)) continue;
    const week = pick(emptyWeek(), value);
    week.checked = strings(week.checked);
    const reflection: Record<string, string> = {};
    for (const [question, answer] of Object.entries(week.reflection)) {
      if (typeof answer === 'string') reflection[question] = answer;
    }
    week.reflection = reflection;
    week.tryFirst.level = Math.max(0, Math.min(4, Math.round(week.tryFirst.level))) as WeekProgress['tryFirst']['level'];
    week.review = isRecord(value.review)
      ? pick(
          { built: '', understood: '', confusing: '', broke: '', shipped: '', evidence: '', hours: 0, change: '', decision: 'continue' as const, at: '' },
          value.review,
        )
      : null;
    if (week.review) week.review.decision = oneOf(week.review.decision, ['continue', 'rebase'], 'continue');
    weeks[n] = week;
  }
  return weeks;
}
