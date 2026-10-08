import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { buildSearchIndex, search, SEARCH_KIND_LABELS } from '../../lib/search';
import { currentWeekNumber } from '../../lib/progress';
import { newLogEntry, newOpportunity } from '../../lib/schema';
import { addLogEntry, addOpportunity, stopSession } from '../../store/actions';
import { useStore } from '../../store/store';
import { navigate } from '../../router';
import { NAV_ITEMS, REPORT_ITEM } from '../shell/nav';
import { useUi } from '../shell/ui-context';
import { useCreateBuild } from '../builds/useCreateBuild';

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: IconName;
  run: () => void;
}

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const { data, update } = useStore();
  const ui = useUi();
  const createBuild = useCreateBuild();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const listId = 'palette-results';
  const week = currentWeekNumber(data);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  const index = useMemo(() => buildSearchIndex(data), [data]);

  const commands = useMemo<PaletteItem[]>(() => {
    const close = (fn: () => void) => () => { onClose(); fn(); };
    return [
      data.activeSession
        ? { id: 'stop', group: 'Actions', label: 'Stop session and log time', icon: 'stop', run: close(() => update(current => stopSession(current))) }
        : { id: 'start', group: 'Actions', label: 'Start a session', hint: 't', icon: 'play', run: close(() => ui.openStartSession({ week })) },
      { id: 'week', group: 'Actions', label: `Open this week (Week ${week})`, icon: 'curriculum', run: close(() => navigate(`#/curriculum/week/${week}`)) },
      { id: 'new-build', group: 'Actions', label: 'New build', icon: 'builds', run: close(() => createBuild({ week })) },
      {
        id: 'new-log',
        group: 'Actions',
        label: 'New build-log entry',
        icon: 'log',
        run: close(() => {
          const entry = newLogEntry({ week });
          update(current => addLogEntry(current, entry));
          navigate(`#/log/${entry.id}`);
        }),
      },
      {
        id: 'new-opportunity',
        group: 'Actions',
        label: 'New opportunity observation',
        icon: 'lab',
        run: close(() => {
          const opportunity = newOpportunity();
          update(current => addOpportunity(current, opportunity));
          navigate(`#/lab/${opportunity.id}`);
        }),
      },
      { id: 'debug', group: 'Actions', label: 'Debug mode: work a problem step by step', icon: 'bug', run: close(() => ui.openDebug({ week })) },
      { id: 'coach', group: 'Actions', label: 'Ask the coach', icon: 'coach', run: close(() => ui.openCoach('coach')) },
      { id: 'log-time', group: 'Actions', label: 'Log time manually', icon: 'clock', run: close(() => ui.openLogTime({ week })) },
      { id: 'export', group: 'Actions', label: 'Export backup', icon: 'download', run: close(() => ui.exportBackup()) },
      { id: 'shortcuts', group: 'Actions', label: 'Keyboard shortcuts', hint: '?', icon: 'search', run: close(() => ui.openHelp()) },
      ...[...NAV_ITEMS, REPORT_ITEM].map(item => ({
        id: `go-${item.id}`,
        group: 'Go to',
        label: item.label,
        hint: `g ${item.key}`,
        icon: item.icon,
        run: close(() => navigate(item.href)),
      })),
    ];
  }, [data.activeSession, week, onClose, update, ui, createBuild]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const matchingCommands = commands.filter(command => command.label.toLowerCase().includes(q));
    const results = search(index, query).map(result => ({
      id: result.id,
      group: SEARCH_KIND_LABELS[result.kind],
      label: result.title,
      hint: result.subtitle,
      icon: (result.kind === 'week' ? 'curriculum' : result.kind === 'opportunity' ? 'lab' : result.kind === 'log' ? 'log' : result.kind === 'resource' ? 'resources' : result.kind === 'portfolio' ? 'portfolio' : result.kind) as IconName,
      run: () => {
        onClose();
        if (result.external) window.open(result.href, '_blank', 'noopener,noreferrer');
        else navigate(result.href);
      },
    }));
    return [...matchingCommands, ...results];
  }, [query, commands, index, onClose]);

  useEffect(() => setActive(0), [query]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(current => Math.min(items.length - 1, current + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(current => Math.max(0, current - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      items[active]?.run();
    }
  };

  useEffect(() => {
    document.getElementById(`palette-item-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  let lastGroup = '';
  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label="Command palette"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onMouseDown={event => { if (event.target === dialog.current) onClose(); }}
    >
      <div className="palette__input">
        <Icon name="search" />
        <input
          autoFocus
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search weeks, builds, logs, opportunities… or type a command"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={items[active] ? `palette-item-${active}` : undefined}
          aria-label="Search or run a command"
        />
        <kbd className="kbd">Esc</kbd>
      </div>
      <ul className="palette__list" id={listId} role="listbox" aria-label="Results">
        {items.length === 0 && <li className="palette__empty" role="presentation">Nothing found for “{query}”.</li>}
        {items.map((item, position) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <li key={`${item.group}-${item.id}`} role="presentation">
              {header && <p className="palette__group mono-label" aria-hidden="true">{header}</p>}
              <div
                id={`palette-item-${position}`}
                role="option"
                aria-selected={position === active}
                className={`palette__item ${position === active ? 'is-active' : ''}`}
                onMouseMove={() => setActive(position)}
                onClick={item.run}
              >
                <Icon name={item.icon} size={16} />
                <span className="palette__label">{item.label}</span>
                {item.hint && <span className="palette__hint">{item.hint}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
