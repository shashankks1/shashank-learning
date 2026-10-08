import { useCallback } from 'react';
import type { Build } from '../../types';
import { getWeek } from '../../curriculum';
import { navigate } from '../../router';
import { newBuild } from '../../lib/schema';
import { addBuild, setWeekBuild } from '../../store/actions';
import { useStore } from '../../store/store';

/** Create a build (optionally for a curriculum week, pre-filled from its brief) and open it. */
export function useCreateBuild() {
  const { update } = useStore();
  return useCallback(
    (options: { week?: number | null; linkToWeek?: boolean; partial?: Partial<Build> } = {}) => {
      const week = options.week ? getWeek(options.week) : undefined;
      const build = newBuild({
        name: week ? week.build.title : 'Untitled build',
        week: week?.n ?? null,
        areas: week ? [...week.areas] : [],
        objective: week ? week.build.brief : '',
        status: week ? 'planned' : 'idea',
        ...options.partial,
      });
      update(current => {
        const next = addBuild(current, build);
        return options.linkToWeek && week ? setWeekBuild(next, week.n, build.id) : next;
      });
      navigate(`#/builds/${build.id}`);
      return build.id;
    },
    [update],
  );
}
