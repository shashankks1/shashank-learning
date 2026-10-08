import { useEffect, useRef, useState } from 'react';
import type { ThemeSetting } from './types';
import { useStore } from './store/store';

/** Re-render on an interval (for the running timer and "today" boundaries). */
export function useTick(intervalMs: number, enabled = true): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick(value => value + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
  return tick;
}

export function useApplyTheme(theme: ThemeSetting, reduceMotion: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    if (reduceMotion) root.dataset.reduceMotion = 'true';
    else delete root.dataset.reduceMotion;
  }, [theme, reduceMotion]);
}

/** Load an evidence image from the image store. */
export function useImage(id: string | null): string | null {
  const { images } = useStore();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setSrc(null);
      return;
    }
    images.get(id).then(value => {
      if (!cancelled) setSrc(value);
    }).catch(() => {
      if (!cancelled) setSrc(null);
    });
    return () => {
      cancelled = true;
    };
  }, [id, images]);
  return src;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export interface HotkeyHandlers {
  onPalette: () => void;
  onHelp: () => void;
  onGo: (key: string) => void;
  onTimer: () => void;
}

/** Ctrl/Cmd+K palette, "?" help, "g then x" navigation, "t" timer. Ignored while typing. */
export function useHotkeys(handlers: HotkeyHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    let awaitingGo = false;
    let goTimer = 0;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        ref.current.onPalette();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('dialog[open]')) return;
      if (awaitingGo) {
        awaitingGo = false;
        window.clearTimeout(goTimer);
        ref.current.onGo(event.key.toLowerCase());
        event.preventDefault();
        return;
      }
      if (event.key === 'g') {
        awaitingGo = true;
        goTimer = window.setTimeout(() => (awaitingGo = false), 1200);
      } else if (event.key === '?') {
        event.preventDefault();
        ref.current.onHelp();
      } else if (event.key === 't') {
        ref.current.onTimer();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
