import type { AppData, Build, CapabilityId } from '../types';
import { curriculum, getWeek } from '../curriculum';
import { isMasteryPassed } from './mastery';
import { weekProgress } from './progress';

export const MATURITY_LABELS = ['Not started', 'Learning', 'Practicing', 'Building', 'Proven', 'Shipped'] as const;
export const MATURITY_DESCRIPTIONS = [
  'No work in this area yet.',
  'Concepts studied.',
  'Exercises done or a week closed.',
  'A build in this area is completed.',
  'A mastery test in this area is passed.',
  'Published, live work in this area.',
] as const;

export interface CapabilityLevel {
  id: CapabilityId;
  label: string;
  level: number; // 0..5
  weeksClosed: number;
  weeksTotal: number;
  evidence: string;
}

function buildAreas(build: Build): CapabilityId[] {
  if (build.areas.length) return build.areas;
  return build.week ? getWeek(build.week)?.areas ?? [] : [];
}

/**
 * Maturity is the highest level with real evidence behind it — never a blended score.
 * Each level names the evidence that earned it.
 */
export function capabilityMap(data: AppData): CapabilityLevel[] {
  return curriculum.capabilityAreas.map(area => {
    const weeks = curriculum.weeks.filter(week => week.areas.includes(area.id));
    const weeksClosed = weeks.filter(week => weekProgress(data, week.n).completedAt).length;
    const builds = data.builds.filter(build => buildAreas(build).includes(area.id));
    const completedBuilds = builds.filter(build => build.status === 'completed' || build.status === 'published');
    const shippedBuild = builds.find(build => build.status === 'published' && build.liveUrl);
    const passedTest = curriculum.mastery.find(test => test.area === area.id && isMasteryPassed(data, test.id));

    const studied = weeks.some(week => weekProgress(data, week.n).checked.some(key => key.startsWith('learn:')));
    const practiced = weeksClosed > 0
      || weeks.some(week => weekProgress(data, week.n).checked.filter(key => key.startsWith('practice:')).length >= 2);
    const builtInWeek = weeks.some(week => weekProgress(data, week.n).buildDone);

    let level = 0;
    let evidence = MATURITY_DESCRIPTIONS[0] as string;
    if (studied) { level = 1; evidence = 'Concepts checked off in the curriculum.'; }
    if (practiced) { level = 2; evidence = weeksClosed ? `${weeksClosed} week(s) closed.` : 'Practice exercises done.'; }
    if (completedBuilds.length || builtInWeek) {
      level = 3;
      evidence = completedBuilds.length ? `Built: ${completedBuilds[0].name}` : 'Weekly build step done.';
    }
    if (passedTest) { level = 4; evidence = `Mastery passed: ${passedTest.title}`; }
    if (shippedBuild && level >= 3) { level = 5; evidence = `Live: ${shippedBuild.name}`; }

    // Founder and business muscles also grow outside the curriculum.
    if (area.id === 'founder') {
      const withEvidence = data.opportunities.filter(item => item.evidence.length > 0);
      const advanced = data.opportunities.filter(item => item.status === 'validating' || item.status === 'promising');
      if (level < 1 && data.opportunities.length) { level = 1; evidence = `${data.opportunities.length} opportunity observation(s).`; }
      if (level < 2 && (withEvidence.length || data.opportunities.length >= 3)) { level = 2; evidence = `${withEvidence.length} observation(s) with evidence.`; }
      if (level < 3 && advanced.length) { level = 3; evidence = `Validating: ${advanced[0].title}`; }
    }
    if (area.id === 'business') {
      const experiments = data.career.experiments;
      const won = experiments.filter(item => item.status === 'won');
      if (level < 2 && experiments.length) { level = 2; evidence = `${experiments.length} career experiment(s).`; }
      if (level < 3 && won.length) { level = 3; evidence = `Won: ${won[0].title}`; }
    }

    return { id: area.id, label: area.label, level, weeksClosed, weeksTotal: weeks.length, evidence };
  });
}
