import { useState } from 'react';
import { TOTAL_WEEKS, getWeek } from '../../curriculum';
import { currentWeekNumber, type CurriculumFilter } from '../../lib/progress';
import { useRoute } from '../../router';
import { useStore } from '../../store/store';
import { TodayView } from './TodayView';
import { WeekView } from './WeekView';
import { MonthView, YearView } from './Overview';

type Tab = 'today' | 'week' | 'month' | 'year';

export function CurriculumPage({ path }: { path: string[] }) {
  const { data } = useStore();
  const route = useRoute();
  const [filter, setFilter] = useState<CurriculumFilter>('all');
  const current = currentWeekNumber(data);
  const [view, param] = path;

  let tab: Tab = 'today';
  let content;
  if (view === 'week') {
    const n = clampWeek(Number(param) || current);
    tab = 'week';
    content = <WeekView key={n} n={n} openReview={route.raw.includes('?review')} />;
  } else if (view === 'month') {
    const month = Math.max(1, Math.min(12, Number(param) || getWeek(current)!.month));
    tab = 'month';
    content = <MonthView month={month} filter={filter} onFilter={setFilter} />;
  } else if (view === 'year') {
    tab = 'year';
    content = <YearView filter={filter} onFilter={setFilter} />;
  } else {
    content = <TodayView />;
  }

  const tabs: { id: Tab; label: string; href: string }[] = [
    { id: 'today', label: 'Today', href: '#/curriculum' },
    { id: 'week', label: 'Week', href: `#/curriculum/week/${current}` },
    { id: 'month', label: 'Month', href: `#/curriculum/month/${getWeek(current)!.month}` },
    { id: 'year', label: 'Year', href: '#/curriculum/year' },
  ];

  return (
    <div className="curriculum">
      <nav className="view-tabs" aria-label="Curriculum views">
        {tabs.map(item => (
          <a key={item.id} href={item.href} className={`view-tabs__tab ${tab === item.id ? 'is-active' : ''}`} aria-current={tab === item.id ? 'page' : undefined}>
            {item.label}
          </a>
        ))}
      </nav>
      {content}
    </div>
  );
}

function clampWeek(n: number): number {
  return Math.max(1, Math.min(TOTAL_WEEKS, Math.round(n)));
}
