import type { AppData, CurriculumWeek, ISODate, WeekProgress } from '../types';
import { curriculum, getWeek, TOTAL_WEEKS } from '../curriculum';
import { addDays, dateOf, daysBetween, today } from './dates';
import { emptyWeek } from './schema';
import { isMasteryPassed } from './mastery';

export type SectionId = 'learn' | 'practice' | 'build' | 'prove' | 'reflect' | 'ship';
export const SECTION_IDS: SectionId[] = ['learn', 'practice', 'build', 'prove', 'reflect', 'ship'];
export const SECTION_LABELS: Record<SectionId, string> = {
  learn: 'Learn',
  practice: 'Practice',
  build: 'Build',
  prove: 'Prove',
  reflect: 'Reflect',
  ship: 'Ship',
};

/** The three questions every week asks, plus the week's own question(s). */
export const STANDARD_REFLECTION = [
  { key: 'confused', label: 'What confused me?' },
  { key: 'broke', label: 'What broke?' },
  { key: 'understand', label: 'What do I understand now?' },
] as const;

export type WeekStatus = 'not-started' | 'in-progress' | 'complete' | 'blocked';
export type CurriculumFilter = 'all' | WeekStatus | 'mastery-pending';

export interface SectionState {
  learn: { done: number; total: number };
  practice: { done: number; total: number };
  build: boolean;
  prove: boolean;
  reflect: boolean;
  ship: boolean;
}

export function weekProgress(data: AppData, n: number): WeekProgress {
  return data.weeks[n] ?? emptyWeek();
}

export function sectionState(data: AppData, week: CurriculumWeek): SectionState {
  const progress = weekProgress(data, week.n);
  const checked = new Set(progress.checked);
  const learnDone = week.learn.filter((_, index) => checked.has(`learn:${index}`)).length;
  const practiceDone = week.practice.filter((_, index) => checked.has(`practice:${index}`)).length;
  const reflectDone = STANDARD_REFLECTION.every(question => (progress.reflection[question.key] ?? '').trim().length > 0);
  return {
    learn: { done: learnDone, total: week.learn.length },
    practice: { done: practiceDone, total: week.practice.length },
    build: progress.buildDone,
    // Weeks with a formal mastery test are only proven when the test is passed.
    prove: week.masteryId ? isMasteryPassed(data, week.masteryId) : progress.proveDone,
    reflect: reflectDone,
    ship: progress.shipDone && progress.shipEvidence.trim().length > 0,
  };
}

export function sectionDone(state: SectionState, section: SectionId): boolean {
  const value = state[section];
  return typeof value === 'boolean' ? value : value.total > 0 && value.done === value.total;
}

/** 0..1 share of the week's work done. A closed week counts as fully done. */
export function weekFraction(data: AppData, week: CurriculumWeek): number {
  if (weekProgress(data, week.n).completedAt) return 1;
  const state = sectionState(data, week);
  const parts = [
    state.learn.total ? state.learn.done / state.learn.total : 0,
    state.practice.total ? state.practice.done / state.practice.total : 0,
    state.build ? 1 : 0,
    state.prove ? 1 : 0,
    state.reflect ? 1 : 0,
    state.ship ? 1 : 0,
  ];
  return parts.reduce((sum, part) => sum + part, 0) / parts.length;
}

export function weekStatus(data: AppData, week: CurriculumWeek): WeekStatus {
  const progress = weekProgress(data, week.n);
  if (progress.completedAt) return 'complete';
  if (progress.blocked) return 'blocked';
  if (progress.startedAt || weekFraction(data, week) > 0) return 'in-progress';
  return 'not-started';
}

/** The learning is done (or the week is closed) but its mastery test hasn't been passed. */
export function isMasteryPending(data: AppData, week: CurriculumWeek): boolean {
  if (!week.masteryId || isMasteryPassed(data, week.masteryId)) return false;
  if (weekProgress(data, week.n).completedAt) return true;
  const state = sectionState(data, week);
  return sectionDone(state, 'learn') && sectionDone(state, 'practice');
}

export function matchesFilter(data: AppData, week: CurriculumWeek, filter: CurriculumFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'mastery-pending') return isMasteryPending(data, week);
  return weekStatus(data, week) === filter;
}

/** First week not yet closed. Past the end, stays on the last week. */
export function currentWeekNumber(data: AppData): number {
  const open = curriculum.weeks.find(week => !weekProgress(data, week.n).completedAt);
  return open ? open.n : TOTAL_WEEKS;
}

export function isYearComplete(data: AppData): boolean {
  return curriculum.weeks.every(week => Boolean(weekProgress(data, week.n).completedAt));
}

export function completedWeeks(data: AppData): number {
  return curriculum.weeks.filter(week => weekProgress(data, week.n).completedAt).length;
}

export function overallFraction(data: AppData): number {
  const total = curriculum.weeks.reduce((sum, week) => sum + weekFraction(data, week), 0);
  return total / TOTAL_WEEKS;
}

/** Concepts studied across the year (learning progress, separate from completion). */
export function conceptsStudied(data: AppData): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const week of curriculum.weeks) {
    const checked = new Set(weekProgress(data, week.n).checked);
    total += week.learn.length;
    done += week.learn.filter((_, index) => checked.has(`learn:${index}`)).length;
  }
  return { done, total };
}

/* ---------------- Schedule ---------------- */

/** Planned Monday for week n, after applying every rebase that affects it. */
export function plannedStart(data: AppData, n: number): ISODate {
  const shift = data.curriculum.rebases
    .filter(rebase => rebase.fromWeek <= n)
    .reduce((sum, rebase) => sum + rebase.shiftWeeks, 0);
  return addDays(data.curriculum.startDate, (n - 1 + shift) * 7);
}

/** Which curriculum week the calendar says you should be on (0 before the start date). */
export function scheduledWeek(data: AppData, on: ISODate = today()): number {
  let scheduled = 0;
  for (let n = 1; n <= TOTAL_WEEKS; n++) {
    if (plannedStart(data, n) <= on) scheduled = n;
  }
  return scheduled;
}

/** Positive = weeks behind the plan; negative = ahead. */
export function weeksBehind(data: AppData): number {
  if (isYearComplete(data)) return 0;
  return scheduledWeek(data) - currentWeekNumber(data);
}

/** Shift needed so the current week starts this Monday. */
export function realignShift(data: AppData, mondayOfThisWeek: ISODate): number {
  const current = currentWeekNumber(data);
  return Math.round(daysBetween(plannedStart(data, current), mondayOfThisWeek) / 7);
}

/* ---------------- Recovery ---------------- */

export type RecoveryLevel = 'none' | 'resume' | 'reassess' | 'reentry';

export function lastActivityDate(data: AppData): ISODate | null {
  let latest: ISODate | null = null;
  for (const activity of data.activities) {
    const day = dateOf(activity.at);
    if (!latest || day > latest) latest = day;
  }
  for (const session of data.sessions) {
    const day = dateOf(session.start);
    if (!latest || day > latest) latest = day;
  }
  return latest;
}

export function recoveryState(data: AppData): { level: RecoveryLevel; weeksMissed: number; daysInactive: number } {
  const last = lastActivityDate(data);
  if (!last) return { level: 'none', weeksMissed: 0, daysInactive: 0 };
  const daysInactive = Math.max(0, daysBetween(last, today()));
  const weeksMissed = Math.floor(daysInactive / 7);
  const level: RecoveryLevel = weeksMissed < 1 ? 'none' : weeksMissed === 1 ? 'resume' : weeksMissed <= 3 ? 'reassess' : 'reentry';
  return { level, weeksMissed, daysInactive };
}

/* ---------------- Today ---------------- */

export interface TodayItem {
  key: string;
  section: SectionId;
  text: string;
}

/** The next unfinished items of the week, in the order the week is meant to be worked. */
export function nextItems(data: AppData, weekNumber: number, limit = 3): TodayItem[] {
  const week = getWeek(weekNumber);
  if (!week) return [];
  const progress = weekProgress(data, weekNumber);
  const checked = new Set(progress.checked);
  const items: TodayItem[] = [];
  week.learn.forEach((text, index) => {
    if (!checked.has(`learn:${index}`)) items.push({ key: `learn:${index}`, section: 'learn', text });
  });
  week.practice.forEach((text, index) => {
    if (!checked.has(`practice:${index}`)) items.push({ key: `practice:${index}`, section: 'practice', text });
  });
  const state = sectionState(data, week);
  if (!state.build) items.push({ key: 'build', section: 'build', text: `Build: ${week.build.title}` });
  if (!state.prove) items.push({ key: 'prove', section: 'prove', text: week.prove });
  if (!state.reflect) items.push({ key: 'reflect', section: 'reflect', text: 'Write this week’s reflection' });
  if (!state.ship) items.push({ key: 'ship', section: 'ship', text: `Ship: ${week.ship}` });
  return items.slice(0, limit);
}

/** A realistic single-session estimate from the weekly hours and a ~4-sessions-a-week rhythm. */
export function sessionEstimate(week: CurriculumWeek): string {
  const [low, high] = week.hours;
  const lowMinutes = Math.round((low * 60) / 4 / 15) * 15;
  const highMinutes = Math.round((high * 60) / 4 / 15) * 15;
  return `${lowMinutes}–${highMinutes} min`;
}
