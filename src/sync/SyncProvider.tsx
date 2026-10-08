import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../types';
import { useStore } from '../store/store';
import { useToast } from '../components/Toast';
import { createGitHubClient, SyncError } from './github';
import { guessDeviceName, loadSyncConfig, saveSyncConfig, type SyncConfig } from './config';
import { connect as connectEngine, hashData, isPristine, syncOnce, type ConnectResult, type ConnectStrategy, type SyncDeps } from './engine';

/*
 * Automatic sync. Runs a round:
 *   - on start, and whenever the app comes back to the foreground or online
 *   - a few seconds after you stop editing
 *   - every two minutes while visible (to pick up changes from another device)
 *   - when the app is hidden, if there are unsynced edits
 */

export type SyncPhase = 'off' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  lastSyncedAt: string | null;
  message: string | null;
}

interface ConnectInput {
  owner: string;
  repo: string;
  token: string;
  device?: string;
}

interface SyncValue {
  status: SyncStatus;
  config: SyncConfig | null;
  dirty: boolean;
  connect: (input: ConnectInput, strategy: ConnectStrategy) => Promise<ConnectResult>;
  disconnect: () => void;
  syncNow: () => Promise<void>;
  renameDevice: (device: string) => void;
}

const SyncContext = createContext<SyncValue | null>(null);
const EDIT_DELAY_MS = 6000;
const POLL_MS = 120_000;

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside <SyncProvider>');
  return value;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { data, replaceAll, images, snapshots } = useStore();
  const toast = useToast();
  const [config, setConfig] = useState<SyncConfig | null>(() => loadSyncConfig());
  const [status, setStatus] = useState<SyncStatus>(() => ({ phase: config ? 'idle' : 'off', lastSyncedAt: config?.lastSyncedAt ?? null, message: null }));
  const configRef = useRef(config);
  const dataRef = useRef<AppData>(data);
  const running = useRef(false);
  const rerun = useRef(false);
  const editTimer = useRef<number | null>(null);
  dataRef.current = data;

  const writeConfig = useCallback((next: SyncConfig | null) => {
    configRef.current = next;
    saveSyncConfig(next);
    setConfig(next);
  }, []);

  const makeDeps = useCallback(
    (current: SyncConfig): SyncDeps => ({
      client: createGitHubClient({ owner: current.owner, repo: current.repo, token: current.token, apiBase: current.apiBase }),
      getConfig: () => configRef.current ?? current,
      getData: () => dataRef.current,
      getImages: () => images.all(),
      replaceAll: async (next, nextImages) => {
        dataRef.current = next;
        await replaceAll(next, nextImages);
      },
      saveConflict: async (label, text) => snapshots.put(label, text),
      saveConfig: patch => {
        const base = configRef.current ?? current;
        writeConfig({ ...base, ...patch });
      },
    }),
    [images, replaceAll, snapshots, writeConfig],
  );

  const runSync = useCallback(async () => {
    const current = configRef.current;
    if (!current) return;
    if (running.current) {
      rerun.current = true;
      return;
    }
    running.current = true;
    setStatus(previous => ({ ...previous, phase: 'syncing', message: null }));
    try {
      const outcome = await syncOnce(makeDeps(current));
      if (outcome === 'pulled') toast('Updated with changes from your other device', 'success');
      if (outcome === 'conflict-kept-remote' || outcome === 'conflict-kept-local') {
        toast('Edits on two devices collided. The newer copy was kept; the other is saved in Settings → Sync.', 'neutral');
      }
      setStatus({ phase: 'idle', lastSyncedAt: configRef.current?.lastSyncedAt ?? null, message: null });
    } catch (error) {
      const offline = error instanceof SyncError && (error.kind === 'offline' || error.kind === 'rate-limit');
      setStatus(previous => ({
        phase: offline ? 'offline' : 'error',
        lastSyncedAt: previous.lastSyncedAt,
        message: error instanceof Error ? error.message : 'Sync failed.',
      }));
    } finally {
      running.current = false;
      if (rerun.current) {
        rerun.current = false;
        void runSync();
      }
    }
  }, [makeDeps, toast]);

  const dirty = Boolean(config) && !isPristine(data) && hashData(data) !== config?.lastSyncedHash;

  // Edits: sync a few seconds after the last change.
  useEffect(() => {
    if (!configRef.current || !dirty) return;
    if (editTimer.current) window.clearTimeout(editTimer.current);
    editTimer.current = window.setTimeout(() => void runSync(), EDIT_DELAY_MS);
    return () => {
      if (editTimer.current) window.clearTimeout(editTimer.current);
    };
  }, [data, dirty, runSync]);

  // Start, foreground, online, and a slow poll for the other device's changes.
  useEffect(() => {
    if (!config) return;
    void runSync();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void runSync();
      else if (configRef.current && hashData(dataRef.current) !== configRef.current.lastSyncedHash) void runSync();
    };
    const onOnline = () => void runSync();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onOnline);
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void runSync();
    }, POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onOnline);
      window.clearInterval(poll);
    };
    // Re-arm only when sync is switched on/off or pointed at another repo, not on every config write.
  }, [config?.owner, config?.repo, config?.token]);

  const connect = useCallback(
    async (input: ConnectInput, strategy: ConnectStrategy) => {
      const draft: SyncConfig = {
        owner: input.owner,
        repo: input.repo,
        token: input.token.trim(),
        device: input.device?.trim() || guessDeviceName(),
        apiBase: configRef.current?.apiBase ?? loadSyncConfig()?.apiBase ?? readTestApiBase(),
        lastRemoteSha: null,
        lastSyncedHash: null,
        lastSyncedAt: null,
        remoteImages: [],
      };
      // Work on the draft until the connection succeeds; only then persist it.
      const previous = configRef.current;
      configRef.current = draft;
      setStatus(current => ({ ...current, phase: 'syncing', message: null }));
      try {
        const result = await connectEngine(makeDeps(draft), strategy);
        if (result.status === 'connected') {
          writeConfig(configRef.current ?? draft);
          setStatus({ phase: 'idle', lastSyncedAt: configRef.current?.lastSyncedAt ?? null, message: null });
        } else {
          configRef.current = previous;
          setStatus(current => ({ ...current, phase: previous ? 'idle' : 'off' }));
        }
        return result;
      } catch (error) {
        configRef.current = previous;
        setStatus(current => ({ ...current, phase: previous ? 'idle' : 'off', message: null }));
        throw error;
      }
    },
    [makeDeps, writeConfig],
  );

  const disconnect = useCallback(() => {
    writeConfig(null);
    setStatus({ phase: 'off', lastSyncedAt: null, message: null });
  }, [writeConfig]);

  const renameDevice = useCallback(
    (device: string) => {
      if (configRef.current) writeConfig({ ...configRef.current, device });
    },
    [writeConfig],
  );

  const value = useMemo<SyncValue>(
    () => ({ status, config, dirty, connect, disconnect, syncNow: runSync, renameDevice }),
    [status, config, dirty, connect, disconnect, runSync, renameDevice],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

/** Test hook: point sync at a local fake GitHub (set by the automated tests only). */
function readTestApiBase(): string | undefined {
  try {
    return localStorage.getItem('level1-builder:sync-api-base') ?? undefined;
  } catch {
    return undefined;
  }
}
