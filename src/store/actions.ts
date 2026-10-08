import type {
  ActiveSession,
  ActivityType,
  AppData,
  Build,
  BuildLogEntry,
  CareerExperiment,
  MasteryProgress,
  Opportunity,
  PortfolioSlot,
  Session,
  TryFirstLevel,
  UserResource,
  WeekProgress,
  WeeklyReview,
} from '../types';
import { getMasteryTest, getWeek } from '../curriculum';
import { dateOf, formatMinutes, minutesBetween, nowISO, today } from '../lib/dates';
import { createId } from '../lib/id';
import { passBlockers, reviewDueDate } from '../lib/mastery';
import { emptyWeek, newMasteryProgress } from '../lib/schema';

/*
 * Every state change is a pure function (AppData in, AppData out).
 * Components call them through `update(d => action(d, ...))`.
 */

/* ---------------- Activity ---------------- */

export function addActivity(data: AppData, type: ActivityType, label: string, ref?: string): AppData {
  const activity = { id: createId('a'), type, at: nowISO(), label, ref };
  // A ref identifies an undoable action; replace rather than duplicate it.
  const others = ref ? data.activities.filter(item => item.ref !== ref) : data.activities;
  return { ...data, activities: [...others, activity] };
}

export function removeActivity(data: AppData, ref: string): AppData {
  return { ...data, activities: data.activities.filter(item => item.ref !== ref) };
}

/* ---------------- Weeks ---------------- */

export function patchWeek(data: AppData, n: number, patch: Partial<WeekProgress>): AppData {
  const current = data.weeks[n] ?? emptyWeek();
  const next: WeekProgress = { ...current, ...patch };
  if (!next.startedAt && !patch.completedAt && hasMeaningfulChange(patch)) next.startedAt = nowISO();
  return { ...data, weeks: { ...data.weeks, [n]: next } };
}

function hasMeaningfulChange(patch: Partial<WeekProgress>): boolean {
  return Boolean(patch.checked?.length || patch.buildDone || patch.proveDone || patch.shipDone || patch.buildId || patch.reflection || patch.tryFirst);
}

export function startWeek(data: AppData, n: number): AppData {
  const current = data.weeks[n] ?? emptyWeek();
  if (current.startedAt) return data;
  return patchWeek(data, n, { startedAt: nowISO() });
}

export function toggleWeekItem(data: AppData, n: number, key: string): AppData {
  const week = getWeek(n);
  const current = data.weeks[n] ?? emptyWeek();
  const ref = `week:${n}:${key}`;
  if (current.checked.includes(key)) {
    return removeActivity(patchWeek(data, n, { checked: current.checked.filter(item => item !== key) }), ref);
  }
  const [section, indexText] = key.split(':');
  const index = Number(indexText);
  const text = section === 'learn' ? week?.learn[index] : week?.practice[index];
  const type: ActivityType = section === 'learn' ? 'lesson' : 'exercise';
  const label = `${section === 'learn' ? 'Studied' : 'Practised'}: ${text ?? key}`;
  return addActivity(patchWeek(data, n, { checked: [...current.checked, key] }), type, label, ref);
}

export function setWeekBuild(data: AppData, n: number, buildId: string | null): AppData {
  return patchWeek(data, n, { buildId });
}

export function setBuildDone(data: AppData, n: number, done: boolean): AppData {
  const ref = `week:${n}:build`;
  const next = patchWeek(data, n, { buildDone: done });
  return done ? addActivity(next, 'build', `Week ${n} build step done: ${getWeek(n)?.build.title ?? ''}`, ref) : removeActivity(next, ref);
}

export function setProveDone(data: AppData, n: number, done: boolean): AppData {
  const ref = `week:${n}:prove`;
  const next = patchWeek(data, n, { proveDone: done });
  return done ? addActivity(next, 'mastery', `Week ${n} proof check done`, ref) : removeActivity(next, ref);
}

export function setReflection(data: AppData, n: number, key: string, value: string): AppData {
  const current = data.weeks[n] ?? emptyWeek();
  const next = patchWeek(data, n, { reflection: { ...current.reflection, [key]: value } });
  const ref = `week:${n}:reflection`;
  const hasAny = Object.values({ ...current.reflection, [key]: value }).some(answer => answer.trim().length > 0);
  if (!hasAny) return removeActivity(next, ref);
  // One activity per week's reflection, refreshed to the latest edit day.
  const existing = data.activities.find(item => item.ref === ref);
  if (existing && dateOf(existing.at) === today()) return next;
  return addActivity(next, 'reflection', `Wrote Week ${n} reflection`, ref);
}

export function setShip(data: AppData, n: number, patch: { done?: boolean; evidence?: string }): AppData {
  const current = data.weeks[n] ?? emptyWeek();
  const done = patch.done ?? current.shipDone;
  const evidence = patch.evidence ?? current.shipEvidence;
  let next = patchWeek(data, n, { shipDone: done, shipEvidence: evidence });
  const ref = `week:${n}:ship`;
  if (patch.done === true) next = addActivity(next, 'ship', `Shipped Week ${n}: ${evidence.slice(0, 80)}`, ref);
  if (patch.done === false) next = removeActivity(next, ref);
  return next;
}

export function setBlocked(data: AppData, n: number, blocked: boolean, reason = ''): AppData {
  return patchWeek(data, n, { blocked, blockedReason: blocked ? reason : '' });
}

export function setTryFirst(data: AppData, n: number, level: TryFirstLevel, attempt?: string): AppData {
  const current = data.weeks[n] ?? emptyWeek();
  const tryFirst = {
    level: Math.max(current.tryFirst.level, level) as TryFirstLevel,
    attempt: attempt ?? current.tryFirst.attempt,
    triedAt: current.tryFirst.triedAt ?? (level >= 1 ? nowISO() : null),
  };
  const next = patchWeek(data, n, { tryFirst });
  if (level === 1 && current.tryFirst.level === 0) {
    return addActivity(next, 'exercise', `Tried Week ${n}’s challenge before looking at hints`, `week:${n}:tryfirst`);
  }
  return next;
}

export function setWeekNotes(data: AppData, n: number, notes: string): AppData {
  return patchWeek(data, n, { notes });
}

export function closeWeek(data: AppData, n: number, review: Omit<WeeklyReview, 'at'>): AppData {
  const at = nowISO();
  const next = patchWeek(data, n, { completedAt: at, blocked: false, blockedReason: '', review: { ...review, at } });
  return addActivity(next, 'reflection', `Completed Week ${n} with a weekly review`, `week:${n}:closed`);
}

export function reopenWeek(data: AppData, n: number): AppData {
  return removeActivity(patchWeek(data, n, { completedAt: null }), `week:${n}:closed`);
}

export function addRebase(data: AppData, fromWeek: number, shiftWeeks: number, reason: string): AppData {
  if (shiftWeeks === 0) return data;
  const rebase = { id: createId('r'), at: nowISO(), fromWeek, shiftWeeks, reason };
  return { ...data, curriculum: { ...data.curriculum, rebases: [...data.curriculum.rebases, rebase] } };
}

/* ---------------- Sessions (time tracking) ---------------- */

export function startSession(data: AppData, session: Omit<ActiveSession, 'start'>): AppData {
  if (data.activeSession) return data;
  return { ...data, activeSession: { ...session, start: nowISO() } };
}

export function stopSession(data: AppData, note = ''): AppData {
  if (!data.activeSession) return data;
  const end = nowISO();
  const minutes = minutesBetween(data.activeSession.start, end);
  const cleared = { ...data, activeSession: null };
  if (minutes < 1) return cleared;
  return addSession(cleared, { ...data.activeSession, end, minutes, note });
}

export function cancelSession(data: AppData): AppData {
  return { ...data, activeSession: null };
}

export function addSession(data: AppData, session: Omit<Session, 'id'>): AppData {
  const record: Session = { ...session, id: createId('s') };
  const next = { ...data, sessions: [...data.sessions, record] };
  return addActivity(next, 'session', `Logged ${formatMinutes(record.minutes)} of ${record.type}${record.week ? ` · Week ${record.week}` : ''}`, `session:${record.id}`);
}

export function deleteSession(data: AppData, id: string): AppData {
  return removeActivity({ ...data, sessions: data.sessions.filter(session => session.id !== id) }, `session:${id}`);
}

/* ---------------- Builds ---------------- */

const BUILD_STATUS_ACTIVITY: Partial<Record<Build['status'], string>> = {
  building: 'Started building',
  completed: 'Completed build',
  published: 'Published project',
};

export function addBuild(data: AppData, build: Build): AppData {
  return addActivity({ ...data, builds: [...data.builds, build] }, 'build', `New build: ${build.name}`, `build:${build.id}:created`);
}

export function updateBuild(data: AppData, id: string, patch: Partial<Build>): AppData {
  const existing = data.builds.find(build => build.id === id);
  if (!existing) return data;
  const next: Build = { ...existing, ...patch, updatedAt: nowISO() };
  if (patch.status && (patch.status === 'completed' || patch.status === 'published') && !existing.completedAt) {
    next.completedAt = nowISO();
  }
  let result: AppData = { ...data, builds: data.builds.map(build => (build.id === id ? next : build)) };
  if (patch.status && patch.status !== existing.status && BUILD_STATUS_ACTIVITY[patch.status]) {
    result = addActivity(result, 'build', `${BUILD_STATUS_ACTIVITY[patch.status]}: ${next.name}`, `build:${id}:${patch.status}`);
  }
  if (patch.githubUrl && !existing.githubUrl) {
    result = addActivity(result, 'build', `Pushed to GitHub: ${next.name}`, `build:${id}:github`);
  }
  return result;
}

export function deleteBuild(data: AppData, id: string): AppData {
  const weeks: AppData['weeks'] = {};
  for (const [n, week] of Object.entries(data.weeks)) {
    weeks[Number(n)] = week.buildId === id ? { ...week, buildId: null } : week;
  }
  return {
    ...data,
    weeks,
    builds: data.builds.filter(build => build.id !== id),
    portfolio: data.portfolio.map(slot => (slot.buildId === id ? { ...slot, buildId: null } : slot)),
    buildLog: data.buildLog.map(entry => (entry.buildId === id ? { ...entry, buildId: null } : entry)),
    sessions: data.sessions.map(session => (session.buildId === id ? { ...session, buildId: null } : session)),
  };
}

/* ---------------- Mastery ---------------- */

function upsertMastery(data: AppData, id: string, change: (progress: MasteryProgress) => MasteryProgress): AppData {
  const existing = data.mastery.find(item => item.id === id) ?? newMasteryProgress(id);
  const next = change(existing);
  const others = data.mastery.filter(item => item.id !== id);
  return { ...data, mastery: [...others, next] };
}

export function updateMastery(data: AppData, id: string, patch: Partial<MasteryProgress>): AppData {
  return upsertMastery(data, id, progress => ({ ...progress, ...patch }));
}

export function toggleMasteryCriterion(data: AppData, id: string, index: number): AppData {
  return upsertMastery(data, id, progress => ({
    ...progress,
    criteria: progress.criteria.includes(index) ? progress.criteria.filter(item => item !== index) : [...progress.criteria, index],
  }));
}

/** Record a pass. Refuses (returns unchanged data) if any blocker remains. */
export function recordMasteryPass(data: AppData, id: string, note: string): AppData {
  const test = getMasteryTest(id);
  const progress = data.mastery.find(item => item.id === id) ?? newMasteryProgress(id);
  if (!test || passBlockers(test, progress).length > 0) return data;
  const at = nowISO();
  const next = upsertMastery(data, id, current => ({
    ...current,
    state: 'passed',
    passedAt: at,
    reviewDueAt: reviewDueDate(),
    attempts: [...current.attempts, { id: createId('att'), at, result: 'passed', note }],
  }));
  return addActivity(next, 'mastery', `Passed mastery: ${test.title}`, `mastery:${id}:passed`);
}

export function recordMasteryNotYet(data: AppData, id: string, note: string): AppData {
  const test = getMasteryTest(id);
  const next = upsertMastery(data, id, current => ({
    ...current,
    state: current.state === 'ready' ? 'building' : current.state,
    attempts: [...current.attempts, { id: createId('att'), at: nowISO(), result: 'not-yet', note }],
  }));
  return addActivity(next, 'mastery', `Mastery attempt (not yet): ${test?.title ?? id}`);
}

/** A due re-check: explain again without notes. Extends the review date. */
export function recordMasteryReverified(data: AppData, id: string, note: string): AppData {
  const test = getMasteryTest(id);
  const next = upsertMastery(data, id, current => ({
    ...current,
    state: 'passed',
    reviewDueAt: reviewDueDate(),
    attempts: [...current.attempts, { id: createId('att'), at: nowISO(), result: 'reverified', note }],
  }));
  return addActivity(next, 'mastery', `Re-verified mastery: ${test?.title ?? id}`);
}

/** Honest step back: a pass can be withdrawn if the learner no longer stands behind it. */
export function withdrawMasteryPass(data: AppData, id: string, note: string): AppData {
  return upsertMastery(data, id, current => ({
    ...current,
    state: 'practicing',
    passedAt: null,
    reviewDueAt: null,
    attempts: [...current.attempts, { id: createId('att'), at: nowISO(), result: 'not-yet', note: note || 'Pass withdrawn for review.' }],
  }));
}

/* ---------------- Opportunity Lab ---------------- */

export function addOpportunity(data: AppData, opportunity: Opportunity): AppData {
  return addActivity({ ...data, opportunities: [...data.opportunities, opportunity] }, 'opportunity', `Added opportunity${opportunity.title ? `: ${opportunity.title}` : ''}`, `opp:${opportunity.id}:created`);
}

export function updateOpportunity(data: AppData, id: string, patch: Partial<Opportunity>): AppData {
  const existing = data.opportunities.find(item => item.id === id);
  if (!existing) return data;
  const next = { ...existing, ...patch, updatedAt: nowISO() };
  let result: AppData = { ...data, opportunities: data.opportunities.map(item => (item.id === id ? next : item)) };
  if (patch.status && patch.status !== existing.status) {
    result = addActivity(result, 'opportunity', `Opportunity moved to ${patch.status}: ${next.title}`, `opp:${id}:${patch.status}`);
  }
  if (patch.evidence && patch.evidence.length > existing.evidence.length) {
    result = addActivity(result, 'opportunity', `Added evidence to: ${next.title}`);
  }
  return result;
}

export function deleteOpportunity(data: AppData, id: string): AppData {
  return { ...data, opportunities: data.opportunities.filter(item => item.id !== id) };
}

/* ---------------- Portfolio ---------------- */

export function updatePortfolioSlot(data: AppData, slotNumber: number, patch: Partial<PortfolioSlot>): AppData {
  const existing = data.portfolio.find(slot => slot.slot === slotNumber);
  if (!existing) return data;
  const next = { ...existing, ...patch, updatedAt: nowISO() };
  let result: AppData = { ...data, portfolio: data.portfolio.map(slot => (slot.slot === slotNumber ? next : slot)) };
  if (patch.status && patch.status !== existing.status) {
    result = addActivity(result, 'portfolio', `Portfolio proof ${slotNumber} → ${patch.status}: ${next.project || 'untitled'}`, `portfolio:${slotNumber}:${patch.status}`);
  }
  return result;
}

/* ---------------- Build log ---------------- */

export function addLogEntry(data: AppData, entry: BuildLogEntry): AppData {
  return addActivity({ ...data, buildLog: [...data.buildLog, entry] }, 'log', `Build log: ${entry.tried || 'new entry'}`, `log:${entry.id}`);
}

export function updateLogEntry(data: AppData, id: string, patch: Partial<BuildLogEntry>): AppData {
  return {
    ...data,
    buildLog: data.buildLog.map(entry => (entry.id === id ? { ...entry, ...patch, updatedAt: nowISO() } : entry)),
  };
}

export function deleteLogEntry(data: AppData, id: string): AppData {
  return removeActivity({ ...data, buildLog: data.buildLog.filter(entry => entry.id !== id) }, `log:${id}`);
}

/* ---------------- Career ---------------- */

export function addExperiment(data: AppData, experiment: CareerExperiment): AppData {
  const next = { ...data, career: { ...data.career, experiments: [...data.career.experiments, experiment] } };
  return addActivity(next, 'career', `Career: ${experiment.title}`, `career:${experiment.id}`);
}

export function updateExperiment(data: AppData, id: string, patch: Partial<CareerExperiment>): AppData {
  return {
    ...data,
    career: { ...data.career, experiments: data.career.experiments.map(item => (item.id === id ? { ...item, ...patch } : item)) },
  };
}

export function deleteExperiment(data: AppData, id: string): AppData {
  return removeActivity({ ...data, career: { ...data.career, experiments: data.career.experiments.filter(item => item.id !== id) } }, `career:${id}`);
}

/* ---------------- Resources ---------------- */

export function addResource(data: AppData, resource: UserResource): AppData {
  return { ...data, resources: [...data.resources, resource] };
}

export function deleteResource(data: AppData, id: string): AppData {
  return { ...data, resources: data.resources.filter(item => item.id !== id) };
}

/* ---------------- Settings ---------------- */

export function dismissReminder(data: AppData, key: string): AppData {
  // Keep the list from growing forever: only the most recent 100 dismissals matter.
  const dismissed = [...data.settings.dismissed.filter(item => item !== key), key].slice(-100);
  return { ...data, settings: { ...data.settings, dismissed } };
}
