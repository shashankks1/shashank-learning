/*
 * Per-device sync settings. Kept OUT of AppData on purpose: the token must
 * never be exported in a backup or synced to other devices.
 */

const KEY = 'level1-builder:sync';

export interface SyncConfig {
  owner: string;
  repo: string;
  token: string;
  device: string;
  apiBase?: string;
  /** sha of level1/data.json the last time this device read or wrote it. */
  lastRemoteSha: string | null;
  /** Hash of the local data at that moment; differs once you edit. */
  lastSyncedHash: string | null;
  lastSyncedAt: string | null;
  /** Image file names known to exist in the data repo. */
  remoteImages: string[];
}

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    if (!parsed.owner || !parsed.repo || !parsed.token) return null;
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      token: parsed.token,
      device: parsed.device || guessDeviceName(),
      apiBase: parsed.apiBase,
      lastRemoteSha: parsed.lastRemoteSha ?? null,
      lastSyncedHash: parsed.lastSyncedHash ?? null,
      lastSyncedAt: parsed.lastSyncedAt ?? null,
      remoteImages: Array.isArray(parsed.remoteImages) ? parsed.remoteImages : [],
    };
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SyncConfig | null): void {
  try {
    if (config) localStorage.setItem(KEY, JSON.stringify(config));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: sync simply won't persist across reloads.
  }
}

/** "Windows · Chrome", "iPhone · Safari" — just a label for commit messages. */
export function guessDeviceName(): string {
  if (typeof navigator === 'undefined') return 'This device';
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${browser}`;
}

/** Parse "owner/repo" or a full GitHub URL. */
export function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const cleaned = input.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const match = cleaned.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
  return match ? { owner: match[1], repo: match[2] } : null;
}

/* ---------- pairing links ---------- */

interface LinkPayload {
  o: string;
  r: string;
  t: string;
}

function toBase64Url(text: string): string {
  return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

/** A link that connects another device in one tap. Contains the token: treat it like a password. */
export function createPairingLink(config: Pick<SyncConfig, 'owner' | 'repo' | 'token'>, appUrl: string): string {
  const payload: LinkPayload = { o: config.owner, r: config.repo, t: config.token };
  return `${appUrl.split('#')[0]}#/connect/${toBase64Url(JSON.stringify(payload))}`;
}

/** A setup link that names the repository but leaves the token for the learner to paste. */
export function createSetupLink(owner: string, repo: string, appUrl: string): string {
  return `${appUrl.split('#')[0]}#/connect/${toBase64Url(JSON.stringify({ o: owner, r: repo }))}`;
}

/** Token is '' for setup links that only name the repository. */
export function readPairingPayload(encoded: string): { owner: string; repo: string; token: string } | null {
  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as Partial<LinkPayload>;
    if (!payload.o || !payload.r) return null;
    return { owner: payload.o, repo: payload.r, token: payload.t ?? '' };
  } catch {
    return null;
  }
}
