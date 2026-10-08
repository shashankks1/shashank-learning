import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, ImageMap } from '../types';
import { backupFilename, createBackup } from '../lib/backup';
import { nowISO } from '../lib/dates';
import { downloadText } from '../lib/files';
import { createId } from '../lib/id';
import { DataError, normalizeAppData } from '../lib/normalize';
import { createEmptyData } from '../lib/schema';
import { memoryStorage, openStorage, type Snapshot, type Storage, type StorageMode } from '../lib/storage';

export type Updater = (data: AppData) => AppData;

type Boot =
  | { phase: 'loading' }
  | { phase: 'ready' }
  | { phase: 'damaged'; rawText: string; reason: string };

interface StoreValue {
  data: AppData;
  update: (updater: Updater) => void;
  storageMode: StorageMode;
  saveError: string | null;
  changedElsewhere: boolean;
  exportBackup: () => Promise<void>;
  replaceAll: (data: AppData, images: ImageMap) => Promise<void>;
  images: {
    get: (id: string) => Promise<string | null>;
    add: (dataUrl: string) => Promise<string>;
    remove: (id: string) => Promise<void>;
    all: () => Promise<ImageMap>;
  };
  snapshots: {
    put: (key: string, text: string) => Promise<void>;
    list: () => Promise<Snapshot[]>;
    remove: (key: string) => Promise<void>;
  };
}

const StoreContext = createContext<StoreValue | null>(null);
const SAVE_DELAY_MS = 350;
const TAB_ID = createId('tab');

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}

/** Convenience: most components only need the data and update. */
export function useData(): [AppData, (updater: Updater) => void] {
  const { data, update } = useStore();
  return [data, update];
}

interface ProviderProps {
  children: ReactNode;
  loading: ReactNode;
  renderDamaged: (props: { rawText: string; reason: string; recover: (data: AppData, images: ImageMap) => Promise<void> }) => ReactNode;
}

export function StoreProvider({ children, loading, renderDamaged }: ProviderProps) {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });
  const [data, setData] = useState<AppData | null>(null);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const pendingSave = useRef<number | null>(null);
  const latest = useRef<AppData | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  // Boot: open storage, load, validate.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const store = await openStorage();
      if (cancelled) return;
      // Ask the browser not to evict our data under storage pressure (granted silently or ignored).
      void navigator.storage?.persist?.().catch(() => false);
      setStorage(store);
      try {
        const result = await store.load();
        if (cancelled) return;
        if (result.status === 'empty') {
          setData(createEmptyData());
          setBoot({ phase: 'ready' });
        } else if (result.status === 'unreadable') {
          setBoot({ phase: 'damaged', rawText: result.rawText, reason: 'The saved data is not valid JSON.' });
        } else {
          const { data: loaded, warnings } = normalizeAppData(result.raw);
          if (warnings.length) console.warn('Data repaired on load:', warnings);
          setData(loaded);
          setBoot({ phase: 'ready' });
        }
      } catch (error) {
        if (cancelled) return;
        const reason = error instanceof DataError ? error.message : 'The saved data could not be read.';
        let rawText = '';
        try {
          const result = await store.load();
          rawText = result.status === 'ok' ? JSON.stringify(result.raw) : result.status === 'unreadable' ? result.rawText : '';
        } catch {
          rawText = '';
        }
        setBoot({ phase: 'damaged', rawText, reason });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Another tab saving means this tab's copy is stale; saving from here would overwrite it.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel('level1-builder');
    bc.onmessage = event => {
      if (event.data?.type === 'saved' && event.data.tab !== TAB_ID) setChangedElsewhere(true);
    };
    channel.current = bc;
    return () => bc.close();
  }, []);

  const persist = useCallback(
    async (snapshot: AppData) => {
      if (!storage) return;
      try {
        await storage.save(snapshot);
        setSaveError(null);
        channel.current?.postMessage({ type: 'saved', tab: TAB_ID });
      } catch (error) {
        const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
        setSaveError(
          quota
            ? 'Browser storage is full. Export a backup now, then remove large screenshots.'
            : 'Could not save to browser storage. Export a backup to keep your work safe.',
        );
      }
    },
    [storage],
  );

  // Debounced save whenever data changes.
  useEffect(() => {
    latest.current = data;
    if (!data || !storage || boot.phase !== 'ready' || changedElsewhere) return;
    if (pendingSave.current) window.clearTimeout(pendingSave.current);
    pendingSave.current = window.setTimeout(() => {
      pendingSave.current = null;
      void persist(data);
    }, SAVE_DELAY_MS);
  }, [data, storage, boot.phase, persist, changedElsewhere]);

  // Flush when the tab is hidden or closed so the last keystrokes are never lost.
  useEffect(() => {
    const flush = () => {
      if (pendingSave.current && latest.current && !changedElsewhere) {
        window.clearTimeout(pendingSave.current);
        pendingSave.current = null;
        void persist(latest.current);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [persist, changedElsewhere]);

  const update = useCallback((updater: Updater) => {
    setData(previous => {
      if (!previous) return previous;
      const next = updater(previous);
      if (next === previous) return previous;
      return { ...next, meta: { ...next.meta, updatedAt: nowISO() } };
    });
  }, []);

  const replaceAll = useCallback(
    async (next: AppData, images: ImageMap) => {
      const target = storage ?? memoryStorage();
      await target.replaceImages(images);
      await target.save(next);
      setData(next);
      setChangedElsewhere(false);
      setBoot({ phase: 'ready' });
      channel.current?.postMessage({ type: 'saved', tab: TAB_ID });
    },
    [storage],
  );

  const exportBackup = useCallback(async () => {
    const snapshot = latest.current;
    if (!snapshot || !storage) return;
    const allImages = await storage.allImages();
    const referenced = new Set<string>();
    snapshot.builds.forEach(build => build.screenshotId && referenced.add(build.screenshotId));
    snapshot.mastery.forEach(progress => progress.evidence.screenshotId && referenced.add(progress.evidence.screenshotId));
    const images = Object.fromEntries(Object.entries(allImages).filter(([id]) => referenced.has(id)));
    const backup = createBackup(snapshot, images, { includeFinancial: snapshot.settings.includeFinancialInExport });
    downloadText(backupFilename(), JSON.stringify(backup, null, 2));
    update(current => ({ ...current, meta: { ...current.meta, lastExportAt: nowISO() } }));
  }, [storage, update]);

  const images = useMemo(
    () => ({
      get: async (id: string) => (storage ? storage.getImage(id) : null),
      add: async (dataUrl: string) => {
        if (!storage) throw new Error('Storage is not ready.');
        const id = createId('img');
        await storage.putImage(id, dataUrl);
        return id;
      },
      remove: async (id: string) => {
        if (storage) await storage.deleteImage(id);
      },
      all: async () => (storage ? storage.allImages() : {}),
    }),
    [storage],
  );

  const snapshots = useMemo(
    () => ({
      put: async (key: string, text: string) => storage?.putSnapshot(key, text),
      list: async () => (storage ? storage.listSnapshots() : []),
      remove: async (key: string) => storage?.deleteSnapshot(key),
    }),
    [storage],
  );

  const recover = useCallback(async (next: AppData, nextImages: ImageMap) => {
    if (boot.phase === 'damaged' && storage && boot.rawText) {
      await storage.quarantine(boot.rawText).catch(() => undefined);
    }
    await replaceAll(next, nextImages);
  }, [boot, storage, replaceAll]);

  if (boot.phase === 'loading') return <>{loading}</>;
  if (boot.phase === 'damaged') return <>{renderDamaged({ rawText: boot.rawText, reason: boot.reason, recover })}</>;
  if (!data || !storage) return <>{loading}</>;

  const value: StoreValue = {
    data,
    update,
    storageMode: storage.mode,
    saveError,
    changedElsewhere,
    exportBackup,
    replaceAll,
    images,
    snapshots,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
