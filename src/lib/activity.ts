import type { ActivityType, AppData, ISODate } from '../types';
import { addDays, dateOf, minutesBetween, nowISO, startOfWeek, today } from './dates';

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  lesson: 'Completing a lesson',
  exercise: 'Completing an exercise',
  build: 'Build progress',
  session: 'Logging a learning/build session',
  mastery: 'Mastery attempts',
  reflection: 'Writing a reflection or review',
  opportunity: 'Researching an opportunity',
  log: 'Writing a build-log entry',
  ship: 'Shipping something',
  career: 'Career experiments',
  portfolio: 'Portfolio updates',
};

/** Days on which at least one counted, meaningful action happened. */
export function activeDays(data: AppData): Set<ISODate> {
  const counts = data.settings.streakTypes;
  const days = new Set<ISODate>();
  for (const activity of data.activities) {
    if (counts[activity.type]) days.add(dateOf(activity.at));
  }
  if (counts.session) {
    for (const session of data.sessions) {
      if (session.minutes > 0) days.add(dateOf(session.start));
    }
  }
  return days;
}

/** Consecutive active days ending today — or yesterday, so the streak survives until today is over. */
export function currentStreak(data: AppData, on: ISODate = today()): number {
  const days = activeDays(data);
  let cursor = days.has(on) ? on : addDays(on, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(data: AppData): number {
  const sorted = [...activeDays(data)].sort();
  let best = 0;
  let run = 0;
  let previous: ISODate | null = null;
  for (const day of sorted) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** Minutes logged with a session starting in [from, to). Includes the running timer. */
export function minutesBetweenDates(data: AppData, from: ISODate, to: ISODate): number {
  let minutes = 0;
  for (const session of data.sessions) {
    const day = dateOf(session.start);
    if (day >= from && day < to) minutes += session.minutes;
  }
  if (data.activeSession) {
    const day = dateOf(data.activeSession.start);
    if (day >= from && day < to) minutes += minutesBetween(data.activeSession.start, nowISO());
  }
  return minutes;
}

export function minutesThisWeek(data: AppData): number {
  const monday = startOfWeek(today());
  return minutesBetweenDates(data, monday, addDays(monday, 7));
}

export function totalMinutes(data: AppData): number {
  return data.sessions.reduce((sum, session) => sum + session.minutes, 0);
}

export function minutesForWeek(data: AppData, week: number): number {
  return data.sessions.filter(session => session.week === week).reduce((sum, session) => sum + session.minutes, 0);
}

/** Calendar-week totals for the last `count` weeks, oldest first. */
export function weeklyMinutesSeries(data: AppData, count: number): { weekStart: ISODate; minutes: number }[] {
  const thisMonday = startOfWeek(today());
  const series = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const weekStart = addDays(thisMonday, -7 * offset);
    series.push({ weekStart, minutes: minutesBetweenDates(data, weekStart, addDays(weekStart, 7)) });
  }
  return series;
}

/** Activity counts per day for a heatmap, covering `weeks` full calendar weeks. */
export function dailyActivity(data: AppData, weeks: number): { day: ISODate; count: number }[] {
  const counts = new Map<ISODate, number>();
  for (const activity of data.activities) {
    const day = dateOf(activity.at);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  for (const session of data.sessions) {
    const day = dateOf(session.start);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const start = addDays(startOfWeek(today()), -7 * (weeks - 1));
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(start, i);
    cells.push({ day, count: counts.get(day) ?? 0 });
  }
  return cells;
}
