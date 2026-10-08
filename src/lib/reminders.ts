import type { AppData } from '../types';
import { getMasteryTest, getWeek } from '../curriculum';
import { daysBetween, dateOf, parseISODate, startOfWeek, today } from './dates';
import { minutesThisWeek } from './activity';
import { effectiveState } from './mastery';
import { currentWeekNumber, isMasteryPending, weekProgress } from './progress';

export interface Reminder {
  /** Stable key; dismissing hides it until the key changes (e.g. next week). */
  key: string;
  tone: 'info' | 'attention';
  text: string;
  action?: { label: string; route?: string; command?: 'export' | 'start-session' };
}

/** Gentle, contextual nudges. Never more than a few, never guilt. */
export function computeReminders(data: AppData, options: { lastSyncedAt?: string | null } = {}): Reminder[] {
  const reminders: Reminder[] = [];
  const now = today();
  const weekKey = startOfWeek(now);
  const current = currentWeekNumber(data);
  // A recent sync means a full copy (with history) already lives on GitHub.
  const recentlySynced = options.lastSyncedAt ? daysBetween(dateOf(options.lastSyncedAt), now) < data.settings.backupReminderDays : false;

  // Backup: the only copy lives in this browser.
  if (!data.meta.isDemo && !recentlySynced) {
    const since = data.meta.lastExportAt ? dateOf(data.meta.lastExportAt) : dateOf(data.meta.createdAt);
    const days = daysBetween(since, now);
    if (days >= data.settings.backupReminderDays) {
      reminders.push({
        key: `backup:${weekKey}`,
        tone: 'attention',
        text: data.meta.lastExportAt
          ? `It’s been ${days} days since your last backup. Your data lives only in this browser.`
          : 'You haven’t exported a backup yet. Your data lives only in this browser.',
        action: { label: 'Export backup', command: 'export' },
      });
    }
  }

  // No session yet this week (only nudge from Thursday on).
  const weekday = parseISODate(now).getDay();
  if ((weekday === 0 || weekday >= 4) && minutesThisWeek(data) === 0 && !data.activeSession) {
    reminders.push({
      key: `no-session:${weekKey}`,
      tone: 'info',
      text: 'You haven’t logged a learning session this week. Even 30 focused minutes keeps the thread.',
      action: { label: 'Start a session', command: 'start-session' },
    });
  }

  // Learning finished, mastery still open (current and previous week).
  for (const n of [current - 1, current]) {
    const week = getWeek(n);
    if (week && week.masteryId && isMasteryPending(data, week)) {
      reminders.push({
        key: `mastery-open:${n}`,
        tone: 'info',
        text: `You’ve finished the learning part of Week ${n}. The mastery challenge is still open.`,
        action: { label: 'Open the test', route: `#/mastery/${week.masteryId}` },
      });
    }
  }

  // Passed masteries due for a no-notes re-check.
  for (const progress of data.mastery) {
    if (effectiveState(progress) === 'needs-review') {
      const test = getMasteryTest(progress.id);
      if (!test) continue;
      reminders.push({
        key: `review:${progress.id}:${progress.reviewDueAt}`,
        tone: 'info',
        text: `“${test.title}” is due for a re-check. Can you still do it without notes?`,
        action: { label: 'Re-check', route: `#/mastery/${progress.id}` },
      });
    }
  }

  // A blocked week deserves a next step, not silence.
  const progress = weekProgress(data, current);
  if (progress.blocked) {
    reminders.push({
      key: `blocked:${current}:${weekKey}`,
      tone: 'attention',
      text: `Week ${current} is marked blocked${progress.blockedReason ? `: ${progress.blockedReason}` : ''}. Try Debug mode, or rebase the week.`,
      action: { label: 'Open week', route: `#/curriculum/week/${current}` },
    });
  }

  const dismissed = new Set(data.settings.dismissed);
  return reminders.filter(reminder => !dismissed.has(reminder.key)).slice(0, 4);
}
