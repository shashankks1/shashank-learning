import { SCHEMA_VERSION, type AppData, type ImageMap, type PortfolioStatus } from '../types';
import { createId } from './id';
import { isHttpUrl } from './format';
import { DataError, isRecord, normalizeAppData } from './normalize';
import { createEmptyData, newLogEntry, newOpportunity } from './schema';
import { nowISO, today } from './dates';

export const BACKUP_FORMAT = 'level1-builder-backup';
/** The format written by the original single-file curriculum page (v1). */
const LEGACY_FORMAT = 'level1-curriculum-backup';

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  app: string;
  schemaVersion: number;
  exportedAt: string;
  data: AppData;
  images: ImageMap;
}

export interface ParsedBackup {
  data: AppData;
  images: ImageMap;
  warnings: string[];
  source: 'current' | 'legacy-v1';
  exportedAt: string | null;
}

export function createBackup(data: AppData, images: ImageMap, options: { includeFinancial: boolean }): BackupFile {
  const exported: AppData = options.includeFinancial
    ? data
    : {
        ...data,
        financial: { ...data.financial, monthlyIncome: null, essentialExpenses: null, liquidSavings: null, monthlyDebt: null },
        user: { ...data.user, currentIncome: null },
        career: {
          ...data.career,
          current: { ...data.career.current, income: null },
          incomeHistory: [],
        },
      };
  return {
    format: BACKUP_FORMAT,
    app: 'Level 1 — Product-Minded AI Builder',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowISO(),
    data: exported,
    images,
  };
}

export function backupFilename(date = today()): string {
  return `level1-backup-${date}.json`;
}

/**
 * Upgrade older schema versions step by step. Each entry upgrades FROM that version.
 * Version 2 is the first schema of this app; v1 backups use a different format (see fromLegacy).
 */
const migrations: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let current = raw;
  let version = typeof current.schemaVersion === 'number' ? current.schemaVersion : SCHEMA_VERSION;
  while (version < SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) throw new DataError(`No upgrade path from schema ${version}.`);
    current = step(current);
    version += 1;
    current.schemaVersion = version;
  }
  return current;
}

/** Parse the text of a backup file. Throws DataError with a user-facing reason. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DataError('The file is not valid JSON.');
  }
  if (!isRecord(raw)) throw new DataError('The file does not contain a backup.');

  if (raw.format === LEGACY_FORMAT) {
    return fromLegacy(raw);
  }
  if (raw.format !== BACKUP_FORMAT) {
    throw new DataError('This is not a Level 1 backup file.');
  }
  if (!isRecord(raw.data)) throw new DataError('The backup has no data section.');

  const { data, warnings } = normalizeAppData(migrate(raw.data));
  const images: ImageMap = {};
  if (isRecord(raw.images)) {
    for (const [id, value] of Object.entries(raw.images)) {
      if (typeof value === 'string' && value.startsWith('data:image/')) images[id] = value;
    }
  }
  return {
    data,
    images,
    warnings,
    source: 'current',
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
  };
}

/** Bring a v1 single-page backup across. Week ticks can't map (v1 had 56 weeks in a different order). */
function fromLegacy(raw: Record<string, unknown>): ParsedBackup {
  const state = isRecord(raw.state) ? raw.state : null;
  if (!state) throw new DataError('The v1 backup has no state.');
  const data = createEmptyData();
  data.meta.onboarded = true;
  const warnings: string[] = [];
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

  const opportunities = Array.isArray(state.opportunities) ? state.opportunities.filter(isRecord) : [];
  data.opportunities = opportunities.map(item => {
    const problem = text(item.problem);
    const evidence = text(item.evidence);
    return newOpportunity({
      title: problem.slice(0, 70) || 'Imported observation',
      problem,
      who: text(item.who),
      workaround: text(item.workaround),
      aiLeverage: text(item.ai),
      unknowns: text(item.unknowns),
      notes: item.date ? `Recorded in v1 on ${text(item.date)}` : '',
      evidence: evidence ? [{ id: createId('e'), date: today(), kind: 'observation', summary: evidence, source: 'Imported from v1' }] : [],
    });
  });

  const log = Array.isArray(state.buildLog) ? state.buildLog.filter(isRecord) : [];
  data.buildLog = log.map(item =>
    newLogEntry({
      tried: text(item.tried),
      broke: text(item.broke),
      why: text(item.why),
      learned: text(item.learned),
      next: text(item.next),
      happened: text(item.evidence) ? `Evidence: ${text(item.evidence)}` : '',
      tags: ['imported-v1'],
    }),
  );

  const weeks = isRecord(state.weeks) ? state.weeks : {};
  let completedInV1 = 0;
  for (const [weekNumber, value] of Object.entries(weeks)) {
    if (!isRecord(value)) continue;
    if (value.done === true) completedInV1 += 1;
    const note = text(value.note);
    if (note) {
      data.buildLog.push(newLogEntry({ tried: `Notes from v1 week ${weekNumber}`, learned: note, tags: ['imported-v1'] }));
    }
  }
  if (completedInV1 > 0) {
    warnings.push(
      `${completedInV1} week(s) were ticked in v1. The curriculum has changed order, so ticks were not carried over. Re-tick the weeks you can still show evidence for.`,
    );
  }

  const portfolio = isRecord(state.portfolio) ? state.portfolio : {};
  const statusMap: Record<string, PortfolioStatus> = { 'not-started': 'not-started', building: 'building', done: 'complete', published: 'published' };
  for (const [index, value] of Object.entries(portfolio)) {
    const slot = data.portfolio[Number(index)];
    if (!slot || !isRecord(value)) continue;
    slot.status = statusMap[text(value.status)] ?? 'not-started';
    const evidence = text(value.evidence);
    if (evidence) {
      if (isHttpUrl(evidence)) {
        if (evidence.includes('github.com')) slot.github = evidence;
        else slot.live = evidence;
      } else {
        slot.result = evidence;
      }
    }
  }

  warnings.push('Imported from the v1 curriculum page. Opportunities, build log, notes and portfolio evidence were carried over.');
  const normalized = normalizeAppData(data);
  return {
    data: normalized.data,
    images: {},
    warnings: [...warnings, ...normalized.warnings],
    source: 'legacy-v1',
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
  };
}
