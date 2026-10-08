import { createContext, useContext } from 'react';

export type CoachMode = 'teacher' | 'coach' | 'debugger' | 'challenger';

/** App-wide UI commands: anything can open the palette, start a session, ask the coach. */
export interface UiCommands {
  openPalette: () => void;
  openHelp: () => void;
  openStartSession: (preset?: { week?: number | null; buildId?: string | null }) => void;
  openLogTime: (preset?: { week?: number | null; buildId?: string | null }) => void;
  openCoach: (mode?: CoachMode, context?: string) => void;
  openDebug: (preset?: { buildId?: string | null; week?: number | null }) => void;
  exportBackup: () => void;
}

export const UiContext = createContext<UiCommands | null>(null);

export function useUi(): UiCommands {
  const value = useContext(UiContext);
  if (!value) throw new Error('useUi must be used inside the app shell');
  return value;
}
