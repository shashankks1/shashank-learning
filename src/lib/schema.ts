import {
  SCHEMA_VERSION,
  type ActivityType,
  type AiAssist,
  type AppData,
  type Build,
  type BuildLogEntry,
  type MasteryProgress,
  type Opportunity,
  type OpportunityDimension,
  type PortfolioSlot,
  type Settings,
  type WeekProgress,
  type YearReview,
} from '../types';
import { nowISO, startOfWeek, today } from './dates';
import { createId } from './id';

/* ---------------- Factories: the single source of default values ---------------- */

export const ACTIVITY_TYPES: ActivityType[] = [
  'lesson',
  'exercise',
  'build',
  'session',
  'mastery',
  'reflection',
  'opportunity',
  'log',
  'ship',
  'career',
  'portfolio',
];

export const OPPORTUNITY_DIMENSIONS: { id: OpportunityDimension; label: string; hint: string }[] = [
  { id: 'severity', label: 'Problem severity', hint: '5 = painful, costly, urgent' },
  { id: 'frequency', label: 'Frequency', hint: '5 = happens daily or weekly' },
  { id: 'market', label: 'Market potential', hint: '5 = many people, growing' },
  { id: 'willingnessToPay', label: 'Willingness to pay', hint: '5 = already paying for workarounds' },
  { id: 'competition', label: 'Existing competition', hint: '5 = open space or weak incumbents' },
  { id: 'feasibility', label: 'Technical feasibility', hint: '5 = you could build a slice now' },
  { id: 'distribution', label: 'Distribution potential', hint: '5 = you can reach buyers cheaply' },
  { id: 'defensibility', label: 'Defensibility', hint: '5 = hard to copy (data, network, trust)' },
  { id: 'timing', label: 'Timing', hint: '5 = something changed recently that makes this possible' },
];

export function emptyAiAssist(): AiAssist {
  return { used: false, helpedWith: '', explain: '', modify: '', reproduce: '' };
}

export function emptyWeek(): WeekProgress {
  return {
    checked: [],
    buildId: null,
    buildDone: false,
    proveDone: false,
    reflection: {},
    shipEvidence: '',
    shipDone: false,
    blocked: false,
    blockedReason: '',
    tryFirst: { level: 0, attempt: '', triedAt: null },
    notes: '',
    startedAt: null,
    completedAt: null,
    review: null,
  };
}

export function defaultSettings(): Settings {
  const streakTypes = Object.fromEntries(ACTIVITY_TYPES.map(type => [type, true])) as Settings['streakTypes'];
  // Admin-ish actions don't prove learning happened that day.
  streakTypes.career = false;
  streakTypes.portfolio = false;
  return {
    theme: 'system',
    reduceMotion: false,
    weeklyTargetMin: 6,
    weeklyTargetMax: 8,
    streakTypes,
    backupReminderDays: 14,
    includeFinancialInExport: true,
    hideFinancials: false,
    dismissed: [],
  };
}

export function emptyYearReview(): YearReview {
  return {
    canBuild: '',
    canExplain: '',
    failures: '',
    breakthroughs: '',
    deepen: '',
    abandon: '',
    learnNext: '',
    earningChange: '',
    thesis: '',
  };
}

export function emptyPortfolio(): PortfolioSlot[] {
  return [1, 2, 3, 4, 5].map(slot => ({
    slot,
    buildId: null,
    project: '',
    capability: '',
    problem: '',
    role: '',
    technology: '',
    designDecisions: '',
    technicalDecisions: '',
    result: '',
    github: '',
    live: '',
    caseStudy: '',
    status: 'not-started',
    updatedAt: null,
  }));
}

export function newBuild(partial: Partial<Build> = {}): Build {
  const stamp = nowISO();
  return {
    id: createId('b'),
    name: 'Untitled build',
    date: today(),
    technology: [],
    areas: [],
    week: null,
    objective: '',
    problem: '',
    status: 'idea',
    githubUrl: '',
    liveUrl: '',
    screenshotId: null,
    learned: '',
    broke: '',
    improve: '',
    portfolioCandidate: false,
    ai: emptyAiAssist(),
    createdAt: stamp,
    updatedAt: stamp,
    completedAt: null,
    ...partial,
  };
}

export function newLogEntry(partial: Partial<BuildLogEntry> = {}): BuildLogEntry {
  const stamp = nowISO();
  return {
    id: createId('l'),
    date: today(),
    buildId: null,
    week: null,
    tried: '',
    happened: '',
    broke: '',
    why: '',
    learned: '',
    changed: '',
    next: '',
    tags: [],
    ai: emptyAiAssist(),
    createdAt: stamp,
    updatedAt: stamp,
    ...partial,
  };
}

export function emptyScores(): Opportunity['scores'] {
  return Object.fromEntries(
    OPPORTUNITY_DIMENSIONS.map(dimension => [dimension.id, { score: 0, note: '' }]),
  ) as Opportunity['scores'];
}

export function newOpportunity(partial: Partial<Opportunity> = {}): Opportunity {
  const stamp = nowISO();
  return {
    id: createId('o'),
    title: '',
    status: 'new',
    problem: '',
    who: '',
    frequency: '',
    workaround: '',
    cost: '',
    existingSolutions: '',
    insufficient: '',
    aiLeverage: '',
    techLeverage: '',
    distribution: '',
    evidence: [],
    unknowns: '',
    scores: emptyScores(),
    notes: '',
    createdAt: stamp,
    updatedAt: stamp,
    ...partial,
  };
}

export function newMasteryProgress(id: string): MasteryProgress {
  return {
    id,
    state: 'not-started',
    criteria: [],
    evidence: { github: '', live: '', screenshotId: null, explanation: '', document: '' },
    reflection: '',
    withinConstraints: false,
    ai: emptyAiAssist(),
    attempts: [],
    passedAt: null,
    reviewDueAt: null,
  };
}

export function createEmptyData(): AppData {
  const stamp = nowISO();
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { createdAt: stamp, updatedAt: stamp, lastExportAt: null, isDemo: false, onboarded: false },
    user: { role: '', currentIncome: null, weeklyHours: 7, technicalLevel: 'some-code', primaryGoal: '' },
    curriculum: { startDate: startOfWeek(today()), rebases: [] },
    weeks: {},
    activities: [],
    sessions: [],
    activeSession: null,
    builds: [],
    mastery: [],
    opportunities: [],
    portfolio: emptyPortfolio(),
    buildLog: [],
    career: {
      current: { role: '', income: null, techLevel: '' },
      target: { role: '', income: null, techLevel: '' },
      stage: 1,
      experiments: [],
      incomeHistory: [],
    },
    financial: {
      monthlyIncome: null,
      essentialExpenses: null,
      liquidSavings: null,
      monthlyDebt: null,
      targetRunwayMonths: 6,
      updatedAt: null,
    },
    resources: [],
    milestones: {},
    yearReview: emptyYearReview(),
    settings: defaultSettings(),
  };
}
