import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';
import { ToastProvider, useToast } from './components/Toast';
import { useApplyTheme, useHotkeys } from './hooks';
import { navigate, useFocusOnRouteChange, useRoute, type Route } from './router';
import { StoreProvider, useStore } from './store/store';
import { StatusBanners } from './features/shell/Banners';
import { NAV_ITEMS, REPORT_ITEM } from './features/shell/nav';
import { LogTimeDialog, StartSessionDialog } from './features/shell/SessionTimer';
import { MobileDrawer, MobileTabBar, MobileTopBar, Sidebar } from './features/shell/Sidebar';
import { UiContext, type CoachMode, type UiCommands } from './features/shell/ui-context';
import { DamagedData } from './features/shell/DamagedData';
import { ShortcutsDialog } from './features/shell/ShortcutsDialog';
import { Dashboard } from './features/dashboard/Dashboard';
import { CurriculumPage } from './features/curriculum/CurriculumPage';
import { Onboarding } from './features/onboarding/Onboarding';
import { stopSession } from './store/actions';
import { SyncProvider } from './sync/SyncProvider';
import { ConnectFromLink } from './features/sync/ConnectFromLink';
import { EmptyState, LinkButton } from './components/ui';

// Everything beyond the daily core loads on demand.
const BuildsPage = lazy(() => import('./features/builds/BuildsPage'));
const BuildDetail = lazy(() => import('./features/builds/BuildDetail'));
const MasteryPage = lazy(() => import('./features/mastery/MasteryPage'));
const MasteryDetail = lazy(() => import('./features/mastery/MasteryDetail'));
const OpportunityLab = lazy(() => import('./features/opportunities/OpportunityLab'));
const OpportunityDetail = lazy(() => import('./features/opportunities/OpportunityDetail'));
const PortfolioPage = lazy(() => import('./features/portfolio/PortfolioPage'));
const PortfolioSlotPage = lazy(() => import('./features/portfolio/PortfolioSlotPage'));
const BuildLogPage = lazy(() => import('./features/buildlog/BuildLogPage'));
const LogEntryPage = lazy(() => import('./features/buildlog/LogEntryPage'));
const CareerPage = lazy(() => import('./features/career/CareerPage'));
const ResourcesPage = lazy(() => import('./features/resources/ResourcesPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const ReportPage = lazy(() => import('./features/report/ReportPage'));
const CommandPalette = lazy(() => import('./features/palette/CommandPalette'));
const CoachPanel = lazy(() => import('./features/coach/CoachPanel'));
const DebugFlow = lazy(() => import('./features/buildlog/DebugFlow'));

export default function App() {
  return (
    <ToastProvider>
      <StoreProvider loading={<Splash />} renderDamaged={props => <DamagedData {...props} />}>
        <SyncProvider>
          <Shell />
        </SyncProvider>
      </StoreProvider>
    </ToastProvider>
  );
}

function Splash() {
  return (
    <div className="splash" role="status">
      <span className="splash__mark">L1</span>
      <span className="visually-hidden">Loading your data…</span>
    </div>
  );
}

type Overlay =
  | { kind: 'none' }
  | { kind: 'palette' }
  | { kind: 'help' }
  | { kind: 'start'; preset?: { week?: number | null; buildId?: string | null } }
  | { kind: 'logtime'; preset?: { week?: number | null; buildId?: string | null } }
  | { kind: 'coach'; mode?: CoachMode; context?: string }
  | { kind: 'debug'; preset?: { buildId?: string | null; week?: number | null } };

function Shell() {
  const { data, update, exportBackup } = useStore();
  const toast = useToast();
  const route = useRoute();
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  useApplyTheme(data.settings.theme, data.settings.reduceMotion);
  useFocusOnRouteChange(route);

  const close = useCallback(() => setOverlay({ kind: 'none' }), []);
  const doExport = useCallback(async () => {
    try {
      await exportBackup();
      toast('Backup downloaded. Keep it somewhere outside this browser.', 'success');
    } catch {
      toast('Export failed. Try again, or copy your data from Settings.', 'error');
    }
  }, [exportBackup, toast]);

  const commands: UiCommands = useMemo(
    () => ({
      openPalette: () => setOverlay({ kind: 'palette' }),
      openHelp: () => setOverlay({ kind: 'help' }),
      openStartSession: preset => setOverlay({ kind: 'start', preset }),
      openLogTime: preset => setOverlay({ kind: 'logtime', preset }),
      openCoach: (mode, context) => setOverlay({ kind: 'coach', mode, context }),
      openDebug: preset => setOverlay({ kind: 'debug', preset }),
      exportBackup: () => void doExport(),
    }),
    [doExport],
  );

  useHotkeys({
    onPalette: () => setOverlay(current => (current.kind === 'palette' ? { kind: 'none' } : { kind: 'palette' })),
    onHelp: () => setOverlay({ kind: 'help' }),
    onGo: key => {
      const item = [...NAV_ITEMS, REPORT_ITEM].find(candidate => candidate.key === key);
      if (item) navigate(item.href);
    },
    onTimer: () => {
      if (data.activeSession) {
        update(current => stopSession(current));
        toast('Session logged', 'success');
      } else {
        setOverlay({ kind: 'start' });
      }
    },
  });

  if (route.path[0] === 'connect') return <ConnectFromLink encoded={route.path[1]} />;
  if (!data.meta.onboarded) return <Onboarding />;

  const section = route.path[0];
  return (
    <UiContext.Provider value={commands}>
      <div className="app">
        <button type="button" className="skip-link" onClick={() => document.getElementById('main')?.focus()}>
          Skip to content
        </button>
        <Sidebar section={section} />
        <div className="app__main">
          <MobileTopBar onMenu={() => setDrawerOpen(true)} />
          <StatusBanners />
          <main id="main" tabIndex={-1} className="page">
            <Suspense fallback={<div className="page-loading" role="status">Loading…</div>}>{renderPage(route)}</Suspense>
          </main>
        </div>
        <MobileTabBar section={section} onMore={() => setDrawerOpen(true)} />
        {drawerOpen && <MobileDrawer section={section} onClose={() => setDrawerOpen(false)} />}
      </div>

      <Suspense fallback={null}>
        {overlay.kind === 'palette' && <CommandPalette onClose={close} />}
        {overlay.kind === 'coach' && <CoachPanel onClose={close} initialMode={overlay.mode} initialContext={overlay.context} />}
        {overlay.kind === 'debug' && <DebugFlow onClose={close} preset={overlay.preset} />}
      </Suspense>
      {overlay.kind === 'help' && <ShortcutsDialog onClose={close} />}
      {overlay.kind === 'start' && <StartSessionDialog onClose={close} preset={overlay.preset} />}
      {overlay.kind === 'logtime' && <LogTimeDialog onClose={close} preset={overlay.preset} />}
    </UiContext.Provider>
  );
}

function renderPage(route: Route): ReactNode {
  const [section, id] = route.path;
  switch (section) {
    case 'dashboard':
      return <Dashboard />;
    case 'curriculum':
      return <CurriculumPage path={route.path.slice(1)} />;
    case 'builds':
      return id ? <BuildDetail id={id} /> : <BuildsPage />;
    case 'mastery':
      return id ? <MasteryDetail id={id} /> : <MasteryPage />;
    case 'lab':
      return id ? <OpportunityDetail id={id} /> : <OpportunityLab />;
    case 'portfolio':
      return id ? <PortfolioSlotPage slot={Number(id)} /> : <PortfolioPage />;
    case 'log':
      return id ? <LogEntryPage id={id} /> : <BuildLogPage />;
    case 'career':
      return <CareerPage />;
    case 'resources':
      return <ResourcesPage />;
    case 'settings':
      return <SettingsPage />;
    case 'report':
      return <ReportPage />;
    default:
      return (
        <EmptyState title="Page not found" action={<LinkButton href="#/dashboard" variant="primary">Back to dashboard</LinkButton>}>
          That address doesn’t match anything in Level 1.
        </EmptyState>
      );
  }
}
