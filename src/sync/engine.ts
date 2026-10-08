import { SCHEMA_VERSION, type AppData, type ImageMap } from '../types';
import { migrate } from '../lib/backup';
import { DataError, isRecord, normalizeAppData } from '../lib/normalize';
import { nowISO } from '../lib/dates';
import { SyncConflictError, SyncError, type GitHubClient } from './github';
import type { SyncConfig } from './config';

/*
 * The sync algorithm, independent of React so it can be tested against a fake GitHub.
 *
 *   remote unchanged + local unchanged → nothing
 *   remote unchanged + local edited    → push
 *   remote changed   + local unchanged → adopt remote
 *   remote changed   + local edited    → the newer copy wins; the other is kept as a conflict copy
 *
 * Demo data and not-yet-onboarded data are never pushed.
 */

export const DATA_PATH = 'level1/data.json';
export const IMAGES_DIR = 'level1/images';
const REMOTE_FORMAT = 'level1-sync';

export interface SyncDeps {
  client: GitHubClient;
  /** Always the latest config (it changes during a round). */
  getConfig(): SyncConfig;
  getData(): AppData;
  getImages(): Promise<ImageMap>;
  replaceAll(data: AppData, images: ImageMap): Promise<void>;
  saveConflict(label: string, text: string): Promise<void>;
  saveConfig(patch: Partial<SyncConfig>): void;
}

export type SyncOutcome = 'pushed' | 'pulled' | 'unchanged' | 'skipped' | 'conflict-kept-remote' | 'conflict-kept-local';

/** FNV-1a 32-bit: cheap change detection, not security. */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16)}-${text.length}`;
}

export const hashData = (data: AppData) => hashText(JSON.stringify(data));

/** Data that isn't really "yours" yet. */
export function isPristine(data: AppData): boolean {
  return !data.meta.onboarded || data.meta.isDemo;
}

export function parseRemoteData(text: string): { data: AppData; savedAt: string | null; device: string | null } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SyncError('The data on GitHub isn’t valid JSON. This device’s data was left untouched; check the repository.');
  }
  if (!isRecord(raw) || raw.format !== REMOTE_FORMAT || !isRecord(raw.data)) {
    throw new SyncError('The file on GitHub isn’t Level 1 sync data.');
  }
  try {
    const { data } = normalizeAppData(migrate(raw.data));
    return { data, savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : null, device: typeof raw.device === 'string' ? raw.device : null };
  } catch (error) {
    if (error instanceof DataError) throw new SyncError(error.message);
    throw error;
  }
}

function serialize(data: AppData, device: string): string {
  return JSON.stringify({ format: REMOTE_FORMAT, schemaVersion: SCHEMA_VERSION, savedAt: nowISO(), device, data });
}

function referencedImageIds(data: AppData): string[] {
  const ids = new Set<string>();
  data.builds.forEach(build => build.screenshotId && ids.add(build.screenshotId));
  data.mastery.forEach(progress => progress.evidence.screenshotId && ids.add(progress.evidence.screenshotId));
  return [...ids];
}

function extensionFor(dataUrl: string): string {
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
  return mime === 'image/svg+xml' ? 'svg' : mime.split('/')[1] || 'bin';
}

const MIME_BY_EXT: Record<string, string> = { webp: 'image/webp', jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', gif: 'image/gif' };

/** Upload screenshots the remote doesn't have yet. Returns the updated remote file list. */
async function pushImages(deps: SyncDeps, data: AppData, knownRemote: string[]): Promise<string[]> {
  const needed = referencedImageIds(data);
  let remote = knownRemote;
  const missing = () => needed.filter(id => !remote.some(name => name.startsWith(`${id}.`)));
  if (missing().length === 0) return remote;
  remote = await deps.client.list(IMAGES_DIR);
  const toUpload = missing();
  if (toUpload.length === 0) return remote;
  const local = await deps.getImages();
  for (const id of toUpload) {
    const dataUrl = local[id];
    if (!dataUrl) continue; // referenced but lost locally; nothing to upload
    const ext = extensionFor(dataUrl);
    const base64 = dataUrl.startsWith('data:') && dataUrl.includes(';base64,')
      ? dataUrl.slice(dataUrl.indexOf(',') + 1)
      : btoa(unescape(encodeURIComponent(decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1)))));
    await deps.client.putBase64(`${IMAGES_DIR}/${id}.${ext}`, base64, `Add screenshot ${id}`);
    remote = [...remote, `${id}.${ext}`];
  }
  return remote;
}

/** Download screenshots this device is missing. */
async function pullImages(deps: SyncDeps, data: AppData, knownRemote: string[]): Promise<{ images: ImageMap; remote: string[] }> {
  const local = await deps.getImages();
  const missing = referencedImageIds(data).filter(id => !local[id]);
  if (missing.length === 0) return { images: local, remote: knownRemote };
  let remote = knownRemote;
  if (missing.some(id => !remote.some(name => name.startsWith(`${id}.`)))) remote = await deps.client.list(IMAGES_DIR);
  const images = { ...local };
  for (const id of missing) {
    const name = remote.find(candidate => candidate.startsWith(`${id}.`));
    if (!name) continue;
    const base64 = await deps.client.getBase64(`${IMAGES_DIR}/${name}`);
    if (!base64) continue;
    const ext = name.split('.').pop() ?? 'webp';
    images[id] = `data:${MIME_BY_EXT[ext] ?? 'application/octet-stream'};base64,${base64}`;
  }
  return { images, remote };
}

async function push(deps: SyncDeps, data: AppData, sha: string | null): Promise<void> {
  const remoteImages = await pushImages(deps, data, deps.getConfig().remoteImages);
  const newSha = await deps.client.putText(DATA_PATH, serialize(data, deps.getConfig().device), sha, `Sync from ${deps.getConfig().device}`);
  deps.saveConfig({ lastRemoteSha: newSha, lastSyncedHash: hashData(data), lastSyncedAt: nowISO(), remoteImages });
}

async function adopt(deps: SyncDeps, remoteData: AppData, sha: string): Promise<void> {
  const { images, remote } = await pullImages(deps, remoteData, deps.getConfig().remoteImages);
  await deps.replaceAll(remoteData, images);
  deps.saveConfig({ lastRemoteSha: sha, lastSyncedHash: hashData(remoteData), lastSyncedAt: nowISO(), remoteImages: remote });
}

/** One sync round. Retries once if GitHub changed underneath us mid-push. */
export async function syncOnce(deps: SyncDeps): Promise<SyncOutcome> {
  try {
    return await syncRound(deps);
  } catch (error) {
    if (error instanceof SyncConflictError) return syncRound(deps);
    throw error;
  }
}

async function syncRound(deps: SyncDeps): Promise<SyncOutcome> {
  const local = deps.getData();
  const localDirty = hashData(local) !== deps.getConfig().lastSyncedHash;
  const pristine = isPristine(local);
  const remote = await deps.client.getText(DATA_PATH);

  if (!remote) {
    if (pristine) return 'skipped';
    await push(deps, local, null);
    return 'pushed';
  }

  if (remote.sha === deps.getConfig().lastRemoteSha) {
    if (!localDirty || pristine) return 'unchanged';
    await push(deps, local, remote.sha);
    return 'pushed';
  }

  const parsed = parseRemoteData(remote.text);
  if (pristine || !localDirty) {
    await adopt(deps, parsed.data, remote.sha);
    return 'pulled';
  }

  // Both sides changed since the last sync. Keep the newer, never lose the other.
  const localJson = JSON.stringify(local);
  if (parsed.data.meta.updatedAt >= local.meta.updatedAt) {
    await deps.saveConflict(`conflict-local-${Date.now()}`, localJson);
    await adopt(deps, parsed.data, remote.sha);
    return 'conflict-kept-remote';
  }
  await deps.saveConflict(`conflict-remote-${Date.now()}`, remote.text);
  await push(deps, local, remote.sha);
  return 'conflict-kept-local';
}

/* ---------- first connection ---------- */

export type ConnectStrategy = 'auto' | 'use-remote' | 'use-local';

export type ConnectResult =
  | { status: 'connected'; outcome: 'pushed' | 'pulled' | 'empty' }
  | { status: 'needs-choice'; remoteSavedAt: string | null; remoteDevice: string | null; remoteWeeksClosed: number };

export async function connect(deps: SyncDeps, strategy: ConnectStrategy): Promise<ConnectResult> {
  const info = await deps.client.repoInfo();
  if (!info.isPrivate) {
    throw new SyncError(`${info.fullName} is public. Your data includes income and notes, so sync only works with a private repository.`);
  }
  if (!info.canPush) throw new SyncError('The token can read but not write this repository. Give it Contents: Read and write.', 'auth');

  const local = deps.getData();
  const remote = await deps.client.getText(DATA_PATH);

  if (!remote) {
    if (isPristine(local)) {
      deps.saveConfig({ lastRemoteSha: null, lastSyncedHash: null });
      return { status: 'connected', outcome: 'empty' };
    }
    await push(deps, local, null);
    return { status: 'connected', outcome: 'pushed' };
  }

  const parsed = parseRemoteData(remote.text);
  if (isPristine(local) || strategy === 'use-remote') {
    if (!isPristine(local)) await deps.saveConflict(`before-connect-${Date.now()}`, JSON.stringify(local));
    await adopt(deps, parsed.data, remote.sha);
    return { status: 'connected', outcome: 'pulled' };
  }
  if (strategy === 'use-local') {
    await deps.saveConflict(`remote-before-connect-${Date.now()}`, remote.text);
    await push(deps, local, remote.sha);
    return { status: 'connected', outcome: 'pushed' };
  }
  return {
    status: 'needs-choice',
    remoteSavedAt: parsed.savedAt,
    remoteDevice: parsed.device,
    remoteWeeksClosed: Object.values(parsed.data.weeks).filter(week => week.completedAt).length,
  };
}
