import type {
  CapabilityArea,
  CapabilityId,
  Curriculum,
  CurriculumMonth,
  CurriculumWeek,
  MasteryTest,
  PortfolioSlotDefinition,
} from '../types';
import meta from '../../data/curriculum/meta.json';

interface MonthFile {
  month: CurriculumMonth;
  weeks: CurriculumWeek[];
  mastery: MasteryTest[];
}

// Each month lives in its own file so the curriculum stays easy to edit.
const monthFiles = import.meta.glob<MonthFile>('../../data/curriculum/month-*.json', {
  eager: true,
  import: 'default',
});

export function assembleCurriculum(
  metaData: typeof meta,
  files: MonthFile[],
): Curriculum {
  const ordered = [...files].sort((a, b) => a.month.n - b.month.n);
  return {
    version: metaData.version,
    principles: metaData.principles,
    capabilityAreas: metaData.capabilityAreas as CapabilityArea[],
    portfolioSlots: metaData.portfolioSlots as PortfolioSlotDefinition[],
    months: ordered.map(file => file.month),
    weeks: ordered.flatMap(file => file.weeks).sort((a, b) => a.n - b.n),
    mastery: ordered.flatMap(file => file.mastery),
  };
}

/** Structural checks so a typo in the JSON fails loudly instead of rendering nonsense. */
export function validateCurriculum(curriculum: Curriculum): string[] {
  const problems: string[] = [];
  const areaIds = new Set(curriculum.capabilityAreas.map(area => area.id));
  const masteryIds = new Set(curriculum.mastery.map(test => test.id));

  curriculum.weeks.forEach((week, index) => {
    if (week.n !== index + 1) problems.push(`Week numbering gap at position ${index + 1} (found ${week.n})`);
    if (!curriculum.months.some(month => month.n === week.month)) problems.push(`Week ${week.n} references unknown month ${week.month}`);
    week.areas.forEach(area => {
      if (!areaIds.has(area)) problems.push(`Week ${week.n} has unknown area "${area}"`);
    });
    if (week.masteryId && !masteryIds.has(week.masteryId)) problems.push(`Week ${week.n} references unknown mastery ${week.masteryId}`);
    if (week.learn.length === 0) problems.push(`Week ${week.n} has no learning items`);
    if (week.practice.length === 0) problems.push(`Week ${week.n} has no practice items`);
  });

  curriculum.mastery.forEach(test => {
    const week = curriculum.weeks.find(candidate => candidate.n === test.week);
    if (!week) problems.push(`Mastery ${test.id} points to missing week ${test.week}`);
    else if (week.masteryId !== test.id) problems.push(`Mastery ${test.id} and week ${test.week} disagree`);
    if (test.criteria.length === 0) problems.push(`Mastery ${test.id} has no success criteria`);
  });

  return problems;
}

export const curriculum: Curriculum = assembleCurriculum(meta, Object.values(monthFiles));

if (import.meta.env.DEV) {
  const problems = validateCurriculum(curriculum);
  if (problems.length) console.warn('Curriculum problems:', problems);
}

export const TOTAL_WEEKS = curriculum.weeks.length;

export function getWeek(n: number): CurriculumWeek | undefined {
  return curriculum.weeks[n - 1];
}

export function getMonth(n: number): CurriculumMonth | undefined {
  return curriculum.months.find(month => month.n === n);
}

export function weeksInMonth(month: number): CurriculumWeek[] {
  return curriculum.weeks.filter(week => week.month === month);
}

export function getMasteryTest(id: string): MasteryTest | undefined {
  return curriculum.mastery.find(test => test.id === id);
}

export function areaLabel(id: CapabilityId): string {
  return curriculum.capabilityAreas.find(area => area.id === id)?.label ?? id;
}

/** Number of items that make up a week's work, used for progress fractions. */
export function weekItemKeys(week: CurriculumWeek): string[] {
  return [
    ...week.learn.map((_, index) => `learn:${index}`),
    ...week.practice.map((_, index) => `practice:${index}`),
  ];
}
