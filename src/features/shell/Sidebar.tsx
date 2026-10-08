import { Icon } from '../../components/Icon';
import { Mark } from '../../components/Mark';
import { KeyHint } from '../../components/ui';
import { dateOf, daysBetween, today } from '../../lib/dates';
import { useStore } from '../../store/store';
import { MOBILE_TABS, NAV_ITEMS, REPORT_ITEM, type NavItem } from './nav';
import { SessionTimer } from './SessionTimer';
import { SyncStatusBadge } from '../sync/SyncPanel';
import { useSync } from '../../sync/SyncProvider';
import { useUi } from './ui-context';

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <a href={item.href} className={`nav-link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
      <Icon name={item.icon} />
      <span className="nav-link__label">{item.label}</span>
      <span className="nav-link__key" aria-hidden="true">g {item.key}</span>
    </a>
  );
}

export function BackupStatus() {
  const { data, storageMode } = useStore();
  const { config } = useSync();
  const ui = useUi();
  const last = data.meta.lastExportAt;
  const days = last ? daysBetween(dateOf(last), today()) : null;
  const stale = !config && (days === null || days >= data.settings.backupReminderDays);
  return (
    <div className={`backup-status ${stale && !data.meta.isDemo ? 'is-stale' : ''}`}>
      <span className="mono-label">
        {storageMode === 'memory' ? 'Not saved: memory only' : days === null ? 'No backup yet' : days === 0 ? 'Backed up today' : `Backup ${days}d ago`}
      </span>
      <button type="button" className="text-btn" onClick={ui.exportBackup}>
        Export
      </button>
    </div>
  );
}

export function Sidebar({ section }: { section: string }) {
  const ui = useUi();
  return (
    <aside className="sidebar" aria-label="Primary">
      <a className="brand" href="#/dashboard">
        <Mark className="brand__mark" />
        <span className="brand__text">
          <span className="brand__name">Level 1</span>
          <span className="brand__sub">Product-Minded AI Builder</span>
        </span>
      </a>

      <button type="button" className="search-trigger" onClick={ui.openPalette}>
        <Icon name="search" size={16} />
        <span>Search…</span>
        <KeyHint>Ctrl K</KeyHint>
      </button>

      <nav className="sidebar__nav" aria-label="Sections">
        {NAV_ITEMS.map(item => (
          <NavLink key={item.id} item={item} active={section === item.id} />
        ))}
        <div className="sidebar__divider" role="separator" />
        <NavLink item={REPORT_ITEM} active={section === REPORT_ITEM.id} />
      </nav>

      <div className="sidebar__foot">
        <SessionTimer />
        <SyncStatusBadge />
        <BackupStatus />
        <p className="sidebar__motto">Protect the floor.<br />Raise the ceiling.</p>
      </div>
    </aside>
  );
}

export function MobileTopBar({ onMenu }: { onMenu: () => void }) {
  const ui = useUi();
  return (
    <header className="mobile-top">
      <button type="button" className="icon-btn" aria-label="Open menu" onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <a className="brand brand--compact" href="#/dashboard">
        <Mark className="brand__mark" />
        <span className="brand__name">Level 1</span>
      </a>
      <div className="mobile-top__actions">
        <SyncStatusBadge compact />
        <SessionTimer compact />
        <button type="button" className="icon-btn" aria-label="Search" onClick={ui.openPalette}>
          <Icon name="search" />
        </button>
      </div>
    </header>
  );
}

export function MobileTabBar({ section, onMore }: { section: string; onMore: () => void }) {
  const tabs = NAV_ITEMS.filter(item => MOBILE_TABS.includes(item.id));
  return (
    <nav className="tabbar" aria-label="Quick navigation">
      {tabs.map(item => (
        <a key={item.id} href={item.href} className={`tabbar__item ${section === item.id ? 'is-active' : ''}`} aria-current={section === item.id ? 'page' : undefined}>
          <Icon name={item.icon} />
          <span>{item.id === 'dashboard' ? 'Today' : item.label}</span>
        </a>
      ))}
      <button type="button" className="tabbar__item" onClick={onMore}>
        <Icon name="menu" />
        <span>More</span>
      </button>
    </nav>
  );
}

export function MobileDrawer({ section, onClose }: { section: string; onClose: () => void }) {
  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" className="drawer__scrim" aria-label="Close menu" onClick={onClose} />
      <div className="drawer__panel">
        <div className="drawer__head">
          <span className="brand__name">Level 1</span>
          <button type="button" className="icon-btn" aria-label="Close menu" onClick={onClose} autoFocus>
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="All sections">
          {[...NAV_ITEMS, REPORT_ITEM].map(item => (
            <NavLink key={item.id} item={item} active={section === item.id} onNavigate={onClose} />
          ))}
        </nav>
        <div className="drawer__foot">
          <SessionTimer />
          <SyncStatusBadge />
          <BackupStatus />
        </div>
      </div>
    </div>
  );
}
