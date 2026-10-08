import type { ISODate, ISODateTime } from '../types';

const DAY_MS = 86_400_000;

/** Local calendar date as YYYY-MM-DD (not UTC: a 1 a.m. session belongs to that local day). */
export function toISODate(date: Date): ISODate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(value: ISODate): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function nowISO(): ISODateTime {
  return new Date().toISOString();
}

export function addDays(value: ISODate, days: number): ISODate {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Whole days from a to b (b - a), immune to daylight-saving shifts. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const utcA = Date.UTC(...splitDate(a));
  const utcB = Date.UTC(...splitDate(b));
  return Math.round((utcB - utcA) / DAY_MS);
}

function splitDate(value: ISODate): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number);
  return [year, month - 1, day];
}

/** Monday of the week containing the given date. */
export function startOfWeek(value: ISODate): ISODate {
  const date = parseISODate(value);
  const offset = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - offset);
  return toISODate(date);
}

export function dateOf(timestamp: ISODateTime): ISODate {
  return toISODate(new Date(timestamp));
}

export function formatDate(value: ISODate | ISODateTime, options: Intl.DateTimeFormatOptions = {}): string {
  const date = value.length === 10 ? parseISODate(value) : new Date(value);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...options });
}

export function formatDateLong(value: ISODate | ISODateTime): string {
  return formatDate(value, { year: 'numeric' });
}

export function formatRelative(timestamp: ISODateTime): string {
  const days = daysBetween(dateOf(timestamp), today());
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(timestamp);
}

/** "just now", "5m ago", "3h ago", "2 days ago". */
export function formatAgo(timestamp: ISODateTime, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(timestamp).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** 125 → "2h 05m" · 40 → "40m". */
export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}m`;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}

/** Elapsed clock for the running timer: 3725s → "1:02:05". */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function minutesBetween(start: ISODateTime, end: ISODateTime): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}
