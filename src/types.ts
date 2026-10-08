/* ------------------------------------------------------------------ *
 * Level 1 data model. Everything the learner creates lives in AppData.
 * Curriculum content (weeks, mastery tests) is static and lives in
 * /data/curriculum — progress refers to it by week number / mastery id.
 * ------------------------------------------------------------------ */

export const SCHEMA_VERSION = 2;

/** YYYY-MM-DD in local time. */
export type ISODate = string;
/** Full ISO timestamp. */
export type ISODateTime = string;

/* ---------- Curriculum (static content) ---------- */

export type CapabilityId =
  | 'programming'
  | 'frontend'
  | 'backend'
  | 'databases'
  | 'ai'
  | 'automation'
  | 'product'
  | 'business'
  | 'founder';

export type ResourceType = 'docs' | 'tutorial' | 'article' | 'video' | 'book' | 'practice';

export interface CurriculumResource {
  title: string;
  url: string;
  type: ResourceType;
  note?: string;
}

export interface TryFirstTask {
  task: string;
  hint: string;
  explanation: string;
  solution: string;
}

export interface CurriculumWeek {
  n: number;
  month: number;
  title: string;
  objective: string;
  areas: CapabilityId[];
  hours: [number, number];
  learn: string[];
  practice: string[];
  build: { title: string; brief: string };
  prove: string;
  masteryId: string | null;
  reflect: string[];
  ship: string;
  tryFirst: TryFirstTask;
  resources: CurriculumResource[];
}

export interface CurriculumMonth {
  n: number;
  title: string;
  theme: string;
  build: string;
  mastery: string;
  checkpoint: string;
}

export type EvidenceKind = 'github' | 'live' | 'screenshot' | 'explanation' | 'document';

export interface MasteryTest {
  id: string;
  week: number;
  area: CapabilityId;
  title: string;
  challenge: string;
  constraints: string[];
  criteria: string[];
  evidence: EvidenceKind[];
}

export interface CapabilityArea {
  id: CapabilityId;
  label: string;
  description: string;
}

export interface PortfolioSlotDefinition {
  slot: number;
  theme: string;
  intent: string;
}

export interface Curriculum {
  version: string;
  principles: string[];
  capabilityAreas: CapabilityArea[];
  portfolioSlots: PortfolioSlotDefinition[];
  months: CurriculumMonth[];
  weeks: CurriculumWeek[];
  mastery: MasteryTest[];
}

/* ---------- Learner data ---------- */

export type TechnicalLevel = 'new' | 'some-code' | 'shipped-small' | 'comfortable';

export interface UserProfile {
  role: string;
  currentIncome: number | null;
  weeklyHours: number;
  technicalLevel: TechnicalLevel;
  primaryGoal: string;
}

export interface Rebase {
  id: string;
  at: ISODateTime;
  fromWeek: number;
  shiftWeeks: number;
  reason: string;
}

export interface CurriculumPlan {
  startDate: ISODate; // Monday of week 1
  rebases: Rebase[];
}

export interface WeeklyReview {
  built: string;
  understood: string;
  confusing: string;
  broke: string;
  shipped: string;
  evidence: string;
  hours: number;
  change: string;
  decision: 'continue' | 'rebase';
  at: ISODateTime;
}

export type TryFirstLevel = 0 | 1 | 2 | 3 | 4; // 0 none · 1 tried · 2 hint · 3 explanation · 4 solution

export interface WeekProgress {
  /** Checked item keys: "learn:0", "practice:2". */
  checked: string[];
  buildId: string | null;
  buildDone: boolean;
  proveDone: boolean;
  reflection: Record<string, string>;
  shipEvidence: string;
  shipDone: boolean;
  blocked: boolean;
  blockedReason: string;
  tryFirst: { level: TryFirstLevel; attempt: string; triedAt: ISODateTime | null };
  notes: string;
  startedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  review: WeeklyReview | null;
}

export type ActivityType =
  | 'lesson'
  | 'exercise'
  | 'build'
  | 'session'
  | 'mastery'
  | 'reflection'
  | 'opportunity'
  | 'log'
  | 'ship'
  | 'career'
  | 'portfolio';

export interface Activity {
  id: string;
  type: ActivityType;
  at: ISODateTime;
  label: string;
  /** Stable reference so an action can be undone (e.g. unchecking a lesson removes its activity). */
  ref?: string;
}

export type SessionType = 'learn' | 'practice' | 'build' | 'mastery' | 'research' | 'review';

export interface Session {
  id: string;
  start: ISODateTime;
  end: ISODateTime;
  minutes: number;
  type: SessionType;
  week: number | null;
  buildId: string | null;
  note: string;
}

export interface ActiveSession {
  start: ISODateTime;
  type: SessionType;
  week: number | null;
  buildId: string | null;
}

export type Confidence = 'yes' | 'partly' | 'no' | '';

/** How AI was used, and whether the learner still owns the result. */
export interface AiAssist {
  used: boolean;
  helpedWith: string;
  explain: Confidence;
  modify: Confidence;
  reproduce: Confidence;
}

export type BuildStatus = 'idea' | 'planned' | 'building' | 'blocked' | 'completed' | 'published';

export interface Build {
  id: string;
  name: string;
  date: ISODate;
  technology: string[];
  areas: CapabilityId[];
  week: number | null;
  objective: string;
  problem: string;
  status: BuildStatus;
  githubUrl: string;
  liveUrl: string;
  screenshotId: string | null;
  learned: string;
  broke: string;
  improve: string;
  portfolioCandidate: boolean;
  ai: AiAssist;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export type MasteryState =
  | 'not-started'
  | 'learning'
  | 'practicing'
  | 'building'
  | 'ready'
  | 'passed'
  | 'needs-review';

export interface MasteryAttempt {
  id: string;
  at: ISODateTime;
  result: 'passed' | 'not-yet' | 'reverified';
  note: string;
}

export interface MasteryProgress {
  id: string;
  state: MasteryState;
  criteria: number[];
  evidence: {
    github: string;
    live: string;
    screenshotId: string | null;
    explanation: string;
    document: string;
  };
  reflection: string;
  withinConstraints: boolean;
  ai: AiAssist;
  attempts: MasteryAttempt[];
  passedAt: ISODateTime | null;
  reviewDueAt: ISODate | null;
}

export type OpportunityStatus = 'new' | 'investigating' | 'validating' | 'promising' | 'archived';

export type OpportunityDimension =
  | 'severity'
  | 'frequency'
  | 'market'
  | 'willingnessToPay'
  | 'competition'
  | 'feasibility'
  | 'distribution'
  | 'defensibility'
  | 'timing';

export interface OpportunityEvidence {
  id: string;
  date: ISODate;
  kind: 'interview' | 'observation' | 'data' | 'article' | 'other';
  summary: string;
  source: string;
}

export interface Opportunity {
  id: string;
  title: string;
  status: OpportunityStatus;
  problem: string;
  who: string;
  frequency: string;
  workaround: string;
  cost: string;
  existingSolutions: string;
  insufficient: string;
  aiLeverage: string;
  techLeverage: string;
  distribution: string;
  evidence: OpportunityEvidence[];
  unknowns: string;
  scores: Record<OpportunityDimension, { score: number; note: string }>;
  notes: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type PortfolioStatus = 'not-started' | 'building' | 'complete' | 'published';

export interface PortfolioSlot {
  slot: number;
  buildId: string | null;
  project: string;
  capability: string;
  problem: string;
  role: string;
  technology: string;
  designDecisions: string;
  technicalDecisions: string;
  result: string;
  github: string;
  live: string;
  caseStudy: string;
  status: PortfolioStatus;
  updatedAt: ISODateTime | null;
}

export interface BuildLogEntry {
  id: string;
  date: ISODate;
  buildId: string | null;
  week: number | null;
  tried: string;
  happened: string;
  broke: string;
  why: string;
  learned: string;
  changed: string;
  next: string;
  tags: string[];
  ai: AiAssist;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type ExperimentType = 'application' | 'freelance' | 'networking' | 'interview' | 'client' | 'product';
export type ExperimentStatus = 'planned' | 'active' | 'waiting' | 'won' | 'lost' | 'closed';

export interface CareerExperiment {
  id: string;
  type: ExperimentType;
  title: string;
  org: string;
  date: ISODate;
  status: ExperimentStatus;
  outcome: string;
  notes: string;
  amount: number | null;
}

export interface IncomeRecord {
  id: string;
  date: ISODate;
  amount: number;
  note: string;
}

export interface Career {
  current: { role: string; income: number | null; techLevel: string };
  target: { role: string; income: number | null; techLevel: string };
  /** Self-assessed position on the 9-stage path (1-based). */
  stage: number;
  experiments: CareerExperiment[];
  incomeHistory: IncomeRecord[];
}

export interface Financial {
  monthlyIncome: number | null;
  essentialExpenses: number | null;
  liquidSavings: number | null;
  monthlyDebt: number | null;
  targetRunwayMonths: number;
  updatedAt: ISODateTime | null;
}

export interface UserResource {
  id: string;
  title: string;
  url: string;
  type: ResourceType;
  week: number | null;
  note: string;
  createdAt: ISODateTime;
}

export interface MilestoneClaim {
  evidence: string;
  at: ISODateTime;
}

export interface YearReview {
  canBuild: string;
  canExplain: string;
  failures: string;
  breakthroughs: string;
  deepen: string;
  abandon: string;
  learnNext: string;
  earningChange: string;
  thesis: string;
}

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemeSetting;
  reduceMotion: boolean;
  weeklyTargetMin: number;
  weeklyTargetMax: number;
  streakTypes: Record<ActivityType, boolean>;
  backupReminderDays: number;
  includeFinancialInExport: boolean;
  hideFinancials: boolean;
  /** Reminder keys the learner has dismissed, e.g. "no-session:2026-W41". */
  dismissed: string[];
}

export interface AppMeta {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastExportAt: ISODateTime | null;
  isDemo: boolean;
  onboarded: boolean;
}

export interface AppData {
  schemaVersion: typeof SCHEMA_VERSION;
  meta: AppMeta;
  user: UserProfile;
  curriculum: CurriculumPlan;
  weeks: Record<number, WeekProgress>;
  activities: Activity[];
  sessions: Session[];
  activeSession: ActiveSession | null;
  builds: Build[];
  mastery: MasteryProgress[];
  opportunities: Opportunity[];
  portfolio: PortfolioSlot[];
  buildLog: BuildLogEntry[];
  career: Career;
  financial: Financial;
  resources: UserResource[];
  milestones: Record<string, MilestoneClaim>;
  yearReview: YearReview;
  settings: Settings;
}

/** Screenshot images live in their own store; exports carry them alongside the data. */
export type ImageMap = Record<string, string>;
