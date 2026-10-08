import type { AppData, ISODate, MasteryProgress, MasteryState, MasteryTest } from '../types';
import { curriculum } from '../curriculum';
import { addDays, today } from './dates';
import { isHttpUrl } from './format';
import { newMasteryProgress } from './schema';

/** Passed masteries come back for a no-notes re-check after this many days. */
export const MASTERY_REVIEW_DAYS = 60;
export const MIN_REFLECTION_CHARS = 120;
export const MIN_EXPLANATION_CHARS = 150;

export const MASTERY_STATE_LABELS: Record<MasteryState, string> = {
  'not-started': 'Not started',
  learning: 'Learning',
  practicing: 'Practicing',
  building: 'Building',
  ready: 'Ready to test',
  passed: 'Passed',
  'needs-review': 'Needs review',
};

/** States the learner can move between by hand. Passed and Needs review are earned, not chosen. */
export const MANUAL_STATES: MasteryState[] = ['not-started', 'learning', 'practicing', 'building', 'ready'];

export function masteryProgress(data: AppData, id: string): MasteryProgress {
  return data.mastery.find(item => item.id === id) ?? newMasteryProgress(id);
}

export function effectiveState(progress: MasteryProgress, on: ISODate = today()): MasteryState {
  if (progress.state === 'passed' && progress.reviewDueAt && progress.reviewDueAt <= on) return 'needs-review';
  return progress.state;
}

/** Passed at least once and not since withdrawn. A due re-check doesn't erase the pass. */
export function isMasteryPassed(data: AppData, id: string): boolean {
  const progress = data.mastery.find(item => item.id === id);
  return Boolean(progress?.passedAt) && (progress?.state === 'passed' || progress?.state === 'needs-review');
}

export function reviewDueDate(from: ISODate = today()): ISODate {
  return addDays(from, MASTERY_REVIEW_DAYS);
}

/**
 * Everything standing between the learner and a pass. Empty list = may record a pass.
 * This is the guard against claiming mastery by clicking a checkbox.
 */
export function passBlockers(test: MasteryTest, progress: MasteryProgress): string[] {
  const blockers: string[] = [];
  if (progress.state !== 'ready') {
    blockers.push('Move the test to “Ready to test” first: attempt it when you feel ready, not before.');
  }
  const unmet = test.criteria.length - test.criteria.filter((_, index) => progress.criteria.includes(index)).length;
  if (unmet > 0) blockers.push(`${unmet} success ${unmet === 1 ? 'criterion is' : 'criteria are'} not met yet.`);

  for (const kind of test.evidence) {
    if (kind === 'github' && !isHttpUrl(progress.evidence.github)) blockers.push('Add the repository URL.');
    if (kind === 'live' && !isHttpUrl(progress.evidence.live)) blockers.push('Add the live / deployed URL.');
    if (kind === 'screenshot' && !progress.evidence.screenshotId) blockers.push('Attach a screenshot.');
    if (kind === 'explanation' && progress.evidence.explanation.trim().length < MIN_EXPLANATION_CHARS) {
      blockers.push(`Write the explanation in your own words (at least ${MIN_EXPLANATION_CHARS} characters).`);
    }
    if (kind === 'document' && !isHttpUrl(progress.evidence.document) && progress.evidence.document.trim().length < 100) {
      blockers.push('Link the document (or paste at least 100 characters of it).');
    }
  }

  if (!progress.withinConstraints) blockers.push('Confirm you worked within the stated constraints.');
  if (progress.reflection.trim().length < MIN_REFLECTION_CHARS) {
    blockers.push(`Reflect on what you actually understood (at least ${MIN_REFLECTION_CHARS} characters).`);
  }
  if (progress.ai.used) {
    if (!progress.ai.helpedWith.trim()) blockers.push('Say what AI helped with.');
    if (progress.ai.explain !== 'yes' || progress.ai.modify !== 'yes') {
      blockers.push('AI helped, but you can’t yet fully explain and modify the result. That’s leverage without ownership, and not mastery yet.');
    }
  }
  return blockers;
}

export function masteryStats(data: AppData, currentWeek: number) {
  const opened = curriculum.mastery.filter(test => test.week <= currentWeek);
  const passed = curriculum.mastery.filter(test => isMasteryPassed(data, test.id));
  const dueForReview = data.mastery.filter(progress => effectiveState(progress) === 'needs-review');
  const ready = data.mastery.filter(progress => progress.state === 'ready');
  return { total: curriculum.mastery.length, opened: opened.length, passed: passed.length, dueForReview: dueForReview.length, ready: ready.length };
}

/** The mastery test the learner is working towards right now. */
export function currentMasteryTest(data: AppData, currentWeek: number): MasteryTest | undefined {
  return curriculum.mastery.find(test => test.week >= currentWeek && !isMasteryPassed(data, test.id))
    ?? curriculum.mastery.find(test => !isMasteryPassed(data, test.id));
}
