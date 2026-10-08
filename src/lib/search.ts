import type { AppData } from '../types';
import { curriculum } from '../curriculum';

export type SearchKind = 'week' | 'mastery' | 'build' | 'log' | 'opportunity' | 'resource' | 'portfolio';

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  week: 'Curriculum',
  mastery: 'Mastery',
  build: 'Builds',
  log: 'Build log',
  opportunity: 'Opportunity Lab',
  resource: 'Resources',
  portfolio: 'Portfolio',
};

export interface SearchItem {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  /** Hash route, or an external URL for resources. */
  href: string;
  external?: boolean;
  text: string;
}

export function buildSearchIndex(data: AppData): SearchItem[] {
  const items: SearchItem[] = [];

  for (const week of curriculum.weeks) {
    items.push({
      id: `week-${week.n}`,
      kind: 'week',
      title: `Week ${week.n} · ${week.title}`,
      subtitle: week.objective,
      href: `#/curriculum/week/${week.n}`,
      text: [week.title, week.objective, ...week.learn, ...week.practice, week.build.title, week.build.brief, week.prove, week.ship].join(' '),
    });
    week.resources.forEach((resource, index) => {
      items.push({
        id: `res-${week.n}-${index}`,
        kind: 'resource',
        title: resource.title,
        subtitle: `Week ${week.n} · ${resource.type}`,
        href: resource.url,
        external: true,
        text: `${resource.title} ${resource.note ?? ''} ${week.title}`,
      });
    });
  }

  for (const test of curriculum.mastery) {
    items.push({
      id: `mastery-${test.id}`,
      kind: 'mastery',
      title: test.title,
      subtitle: `Week ${test.week} mastery test`,
      href: `#/mastery/${test.id}`,
      text: [test.title, test.challenge, ...test.criteria, ...test.constraints].join(' '),
    });
  }

  for (const build of data.builds) {
    items.push({
      id: build.id,
      kind: 'build',
      title: build.name,
      subtitle: [build.status, ...build.technology].join(' · '),
      href: `#/builds/${build.id}`,
      text: [build.name, build.objective, build.problem, build.learned, build.broke, build.improve, ...build.technology].join(' '),
    });
  }

  for (const entry of data.buildLog) {
    items.push({
      id: entry.id,
      kind: 'log',
      title: entry.tried || 'Build log entry',
      subtitle: entry.date,
      href: `#/log/${entry.id}`,
      text: [entry.tried, entry.happened, entry.broke, entry.why, entry.learned, entry.changed, entry.next, ...entry.tags].join(' '),
    });
  }

  for (const opportunity of data.opportunities) {
    items.push({
      id: opportunity.id,
      kind: 'opportunity',
      title: opportunity.title || 'Untitled observation',
      subtitle: `${opportunity.status} · ${opportunity.who || 'who?'}`,
      href: `#/lab/${opportunity.id}`,
      text: [
        opportunity.title,
        opportunity.problem,
        opportunity.who,
        opportunity.workaround,
        opportunity.existingSolutions,
        opportunity.notes,
        ...opportunity.evidence.map(evidence => evidence.summary),
      ].join(' '),
    });
  }

  for (const resource of data.resources) {
    items.push({
      id: resource.id,
      kind: 'resource',
      title: resource.title,
      subtitle: `Your resource · ${resource.type}`,
      href: resource.url,
      external: true,
      text: `${resource.title} ${resource.note}`,
    });
  }

  for (const slot of data.portfolio) {
    if (!slot.project) continue;
    items.push({
      id: `portfolio-${slot.slot}`,
      kind: 'portfolio',
      title: slot.project,
      subtitle: `Portfolio proof ${slot.slot} · ${slot.status}`,
      href: `#/portfolio/${slot.slot}`,
      text: [slot.project, slot.capability, slot.problem, slot.technology, slot.result].join(' '),
    });
  }

  return items;
}

/** Every query word must appear; title matches rank first. */
export function search(index: SearchItem[], query: string, limit = 24): SearchItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of index) {
    const title = item.title.toLowerCase();
    const haystack = `${title} ${item.subtitle.toLowerCase()} ${item.text.toLowerCase()}`;
    if (!words.every(word => haystack.includes(word))) continue;
    let score = 0;
    for (const word of words) {
      if (title.startsWith(word)) score += 6;
      else if (title.includes(word)) score += 4;
      else score += 1;
    }
    scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(entry => entry.item);
}
