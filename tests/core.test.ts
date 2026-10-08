import { describe, expect, it } from 'vitest';
import { curriculum, getMasteryTest, TOTAL_WEEKS, validateCurriculum } from '../src/curriculum';
import { createEmptyData, newMasteryProgress } from '../src/lib/schema';
import { normalizeAppData, DataError } from '../src/lib/normalize';
import { createBackup, parseBackup } from '../src/lib/backup';
import { createDemoData } from '../src/lib/demo';
import { passBlockers, isMasteryPassed } from '../src/lib/mastery';
import { currentStreak, longestStreak } from '../src/lib/activity';
import { calculateRunway } from '../src/lib/runway';
import {
  currentWeekNumber,
  isMasteryPending,
  plannedStart,
  realignShift,
  recoveryState,
  scheduledWeek,
  sectionState,
  weekStatus,
} from '../src/lib/progress';
import { addDays, startOfWeek, today } from '../src/lib/dates';
import {
  addRebase,
  closeWeek,
  recordMasteryPass,
  setShip,
  toggleWeekItem,
  updateMastery,
} from '../src/store/actions';
import type { AppData } from '../src/types';

const review = { built: 'x', understood: 'y', confusing: '', broke: '', shipped: '', evidence: '', hours: 6, change: '', decision: 'continue' as const };

describe('curriculum content', () => {
  it('has 52 consistent weeks, 12 months and valid mastery links', () => {
    expect(TOTAL_WEEKS).toBe(52);
    expect(curriculum.months).toHaveLength(12);
    expect(validateCurriculum(curriculum)).toEqual([]);
  });

  it('gives every week the full Learn/Practice/Build/Prove/Reflect/Ship framework and a Try First task', () => {
    for (const week of curriculum.weeks) {
      expect(week.learn.length, `week ${week.n} learn`).toBeGreaterThan(0);
      expect(week.practice.length, `week ${week.n} practice`).toBeGreaterThan(0);
      expect(week.build.title && week.prove && week.ship).toBeTruthy();
      expect(week.tryFirst.task && week.tryFirst.hint && week.tryFirst.explanation && week.tryFirst.solution).toBeTruthy();
      week.resources.forEach(resource => expect(resource.url).toMatch(/^https:\/\//));
    }
  });
});

describe('progress model', () => {
  it('starts a fresh plan on week 1, not started', () => {
    const data = createEmptyData();
    expect(currentWeekNumber(data)).toBe(1);
    expect(weekStatus(data, curriculum.weeks[0])).toBe('not-started');
  });

  it('moves to in-progress when a concept is checked and records an undoable activity', () => {
    let data = createEmptyData();
    data = toggleWeekItem(data, 1, 'learn:0');
    expect(weekStatus(data, curriculum.weeks[0])).toBe('in-progress');
    expect(data.activities).toHaveLength(1);
    data = toggleWeekItem(data, 1, 'learn:0');
    expect(data.activities).toHaveLength(0);
  });

  it('only counts Ship as done when there is evidence', () => {
    let data = createEmptyData();
    data = setShip(data, 1, { done: true });
    expect(sectionState(data, curriculum.weeks[0]).ship).toBe(false);
    data = setShip(data, 1, { evidence: 'https://github.com/me/page' });
    expect(sectionState(data, curriculum.weeks[0]).ship).toBe(true);
  });

  it('closes a week with a review and advances, flagging an unpassed mastery as pending', () => {
    let data = createEmptyData();
    data = closeWeek(data, 1, review);
    expect(currentWeekNumber(data)).toBe(2);
    expect(weekStatus(data, curriculum.weeks[0])).toBe('complete');
    expect(isMasteryPending(data, curriculum.weeks[0])).toBe(true);
  });
});

describe('mastery gate', () => {
  const test = getMasteryTest('m01')!;

  it('refuses a pass while requirements are missing', () => {
    let data = createEmptyData();
    data = updateMastery(data, 'm01', { state: 'ready' });
    const progress = data.mastery.find(item => item.id === 'm01')!;
    expect(passBlockers(test, progress).length).toBeGreaterThan(0);
    const after = recordMasteryPass(data, 'm01', 'trying');
    expect(isMasteryPassed(after, 'm01')).toBe(false);
  });

  it('allows a pass once evidence, criteria, constraints and reflection are in', () => {
    let data = createEmptyData();
    data = updateMastery(data, 'm01', {
      state: 'ready',
      criteria: test.criteria.map((_, index) => index),
      evidence: { github: '', live: '', screenshotId: 'img_1', explanation: 'e'.repeat(160), document: '' },
      reflection: 'r'.repeat(130),
      withinConstraints: true,
    });
    data = recordMasteryPass(data, 'm01', 'done');
    expect(isMasteryPassed(data, 'm01')).toBe(true);
  });

  it('treats AI help without ownership as not mastery', () => {
    const progress = {
      ...newMasteryProgress('m01'),
      state: 'ready' as const,
      criteria: test.criteria.map((_, index) => index),
      evidence: { github: '', live: '', screenshotId: 'img_1', explanation: 'e'.repeat(160), document: '' },
      reflection: 'r'.repeat(130),
      withinConstraints: true,
      ai: { used: true, helpedWith: 'wrote the form', explain: 'partly' as const, modify: 'yes' as const, reproduce: 'no' as const },
    };
    expect(passBlockers(test, progress).some(blocker => blocker.includes('ownership'))).toBe(true);
  });
});

describe('streak', () => {
  const withDays = (offsets: number[]): AppData => {
    const data = createEmptyData();
    data.activities = offsets.map((offset, index) => ({
      id: `a${index}`,
      type: 'lesson',
      at: new Date(`${addDays(today(), offset)}T12:00:00`).toISOString(),
      label: 'x',
    }));
    return data;
  };

  it('counts consecutive days ending today', () => {
    expect(currentStreak(withDays([0, -1, -2]))).toBe(3);
  });

  it('survives until today is over (ends yesterday)', () => {
    expect(currentStreak(withDays([-1, -2]))).toBe(2);
  });

  it('breaks on a gap and tracks the longest run', () => {
    const data = withDays([0, -2, -3, -4, -5]);
    expect(currentStreak(data)).toBe(1);
    expect(longestStreak(data)).toBe(4);
  });

  it('ignores activity types the learner excluded', () => {
    const data = withDays([0, -1]);
    data.settings.streakTypes.lesson = false;
    expect(currentStreak(data)).toBe(0);
  });
});

describe('schedule, rebase and recovery', () => {
  it('rebasing shifts planned dates without touching progress', () => {
    let data = createEmptyData();
    data.curriculum.startDate = addDays(startOfWeek(today()), -28); // 4 weeks ago
    data = closeWeek(data, 1, review);
    expect(scheduledWeek(data)).toBe(5);
    const shift = realignShift(data, startOfWeek(today()));
    data = addRebase(data, currentWeekNumber(data), shift, 'test');
    expect(plannedStart(data, 2)).toBe(startOfWeek(today()));
    expect(data.weeks[1].completedAt).toBeTruthy();
  });

  it('escalates the recovery protocol with time away, never resetting', () => {
    const data = createEmptyData();
    data.activities = [{ id: 'a', type: 'lesson', at: new Date(`${addDays(today(), -30)}T12:00:00`).toISOString(), label: 'x' }];
    expect(recoveryState(data).level).toBe('reentry');
    data.activities[0].at = new Date(`${addDays(today(), -15)}T12:00:00`).toISOString();
    expect(recoveryState(data).level).toBe('reassess');
    data.activities[0].at = new Date(`${addDays(today(), -8)}T12:00:00`).toISOString();
    expect(recoveryState(data).level).toBe('resume');
  });
});

describe('runway', () => {
  it('divides liquid savings by essentials plus debt payments', () => {
    const result = calculateRunway({ monthlyIncome: 30000, essentialExpenses: 17000, monthlyDebt: 3000, liquidSavings: 60000, targetRunwayMonths: 6, updatedAt: null })!;
    expect(result.monthlyBurn).toBe(20000);
    expect(result.runwayMonths).toBe(3);
    expect(result.gapToTarget).toBe(60000);
    expect(result.monthsToTarget).toBe(6);
    expect(result.band).toBe('cushion');
  });

  it('returns nothing until it has the inputs', () => {
    expect(calculateRunway({ monthlyIncome: null, essentialExpenses: null, monthlyDebt: null, liquidSavings: 1000, targetRunwayMonths: 6, updatedAt: null })).toBeNull();
  });
});

describe('data integrity: normalize, backup, import', () => {
  it('repairs missing fields and drops malformed records', () => {
    const { data, warnings } = normalizeAppData({ schemaVersion: 2, builds: [{ id: 'b1', name: 'Ok', status: 'nonsense' }, { name: 'no id' }] });
    expect(data.builds).toHaveLength(1);
    expect(data.builds[0].status).toBe('idea');
    expect(data.portfolio).toHaveLength(5);
    expect(warnings.length).toBe(1);
  });

  it('rejects data from a newer schema', () => {
    expect(() => normalizeAppData({ schemaVersion: 99 })).toThrow(DataError);
  });

  it('round-trips the demo through export and import', () => {
    const { data, images } = createDemoData();
    const text = JSON.stringify(createBackup(data, images, { includeFinancial: true }));
    const parsed = parseBackup(text);
    expect(parsed.data.builds).toHaveLength(2);
    expect(parsed.data.opportunities).toHaveLength(3);
    expect(Object.keys(parsed.images)).toHaveLength(1);
    expect(parsed.data.financial.liquidSavings).toBe(52000);
  });

  it('strips money from exports when asked', () => {
    const { data, images } = createDemoData();
    const parsed = parseBackup(JSON.stringify(createBackup(data, images, { includeFinancial: false })));
    expect(parsed.data.financial.liquidSavings).toBeNull();
    expect(parsed.data.career.current.income).toBeNull();
  });

  it('refuses files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(DataError);
    expect(() => parseBackup('{"hello":1}')).toThrow(DataError);
  });

  it('imports a v1 curriculum-page backup', () => {
    const v1 = {
      format: 'level1-curriculum-backup',
      version: 2,
      state: {
        weeks: { 1: { done: true, note: 'Set up the repo' } },
        gates: {},
        portfolio: { 0: { status: 'done', evidence: 'https://github.com/me/page' } },
        opportunities: [{ date: '5/10/2026', problem: 'Shops retype bills', who: 'Kirana owners', workaround: 'Typing', ai: 'OCR', evidence: 'Saw it', unknowns: 'Price' }],
        buildLog: [{ date: '5/10/2026', tried: 'Grid', broke: 'Overflow', why: 'Fixed width', learned: 'max-width', next: 'Reset', evidence: '' }],
      },
    };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.source).toBe('legacy-v1');
    expect(parsed.data.opportunities[0].problem).toBe('Shops retype bills');
    expect(parsed.data.buildLog).toHaveLength(2); // entry + week note
    expect(parsed.data.portfolio[0].status).toBe('complete');
    expect(parsed.data.portfolio[0].github).toBe('https://github.com/me/page');
    expect(parsed.warnings.some(warning => warning.includes('ticked in v1'))).toBe(true);
  });
});

describe('demo data', () => {
  it('matches the spec: week 3, two weeks closed, 2 builds, 1 mastery passed, 3 opportunities, 1 portfolio proof', () => {
    const { data } = createDemoData();
    expect(currentWeekNumber(data)).toBe(3);
    expect(data.builds).toHaveLength(2);
    expect(curriculum.mastery.filter(test => isMasteryPassed(data, test.id))).toHaveLength(1);
    expect(data.opportunities).toHaveLength(3);
    expect(data.portfolio.filter(slot => slot.status === 'published')).toHaveLength(1);
    expect(normalizeAppData(JSON.parse(JSON.stringify(data))).warnings).toEqual([]);
  });
});
