import { describe, expect, it } from 'vitest';
import type { AppData, ImageMap } from '../src/types';
import { createEmptyData, newBuild } from '../src/lib/schema';
import { createDemoData } from '../src/lib/demo';
import { addBuild, toggleWeekItem } from '../src/store/actions';
import { connect, DATA_PATH, IMAGES_DIR, syncOnce, type SyncDeps } from '../src/sync/engine';
import { createPairingLink, parseRepoInput, readPairingPayload, type SyncConfig } from '../src/sync/config';
import { base64ToText, SyncConflictError, textToBase64, type GitHubClient } from '../src/sync/github';

/** In-memory stand-in for one private GitHub repository. */
class FakeRepo implements GitHubClient {
  files = new Map<string, { sha: string; base64: string }>();
  commits = 0;
  constructor(public isPrivate = true) {}
  private nextSha() {
    this.commits += 1;
    return `sha${this.commits}`;
  }
  async repoInfo() {
    return { fullName: 'me/level-1-data', isPrivate: this.isPrivate, canPush: true };
  }
  async getText(path: string) {
    const file = this.files.get(path);
    return file ? { sha: file.sha, text: base64ToText(file.base64) } : null;
  }
  async putText(path: string, text: string, sha: string | null) {
    const existing = this.files.get(path);
    if ((existing?.sha ?? null) !== sha) throw new SyncConflictError('sha mismatch');
    const next = this.nextSha();
    this.files.set(path, { sha: next, base64: textToBase64(text) });
    return next;
  }
  async getBase64(path: string) {
    return this.files.get(path)?.base64 ?? null;
  }
  async putBase64(path: string, base64: string) {
    if (!this.files.has(path)) this.files.set(path, { sha: this.nextSha(), base64 });
  }
  async list(dir: string) {
    return [...this.files.keys()].filter(path => path.startsWith(`${dir}/`)).map(path => path.slice(dir.length + 1));
  }
}

/** One browser: its own data, images, sync config and saved conflict copies. */
class Device {
  data: AppData;
  images: ImageMap = {};
  config: SyncConfig;
  conflicts: string[] = [];
  constructor(public repo: FakeRepo, data: AppData, name: string) {
    this.data = data;
    this.config = { owner: 'me', repo: 'level-1-data', token: 't', device: name, lastRemoteSha: null, lastSyncedHash: null, lastSyncedAt: null, remoteImages: [] };
  }
  get deps(): SyncDeps {
    return {
      client: this.repo,
      getConfig: () => this.config,
      getData: () => this.data,
      getImages: async () => this.images,
      replaceAll: async (data, images) => {
        this.data = data;
        this.images = images;
      },
      saveConflict: async label => {
        this.conflicts.push(label);
      },
      saveConfig: patch => {
        this.config = { ...this.config, ...patch };
      },
    };
  }
  edit(change: (data: AppData) => AppData) {
    const next = change(this.data);
    this.data = { ...next, meta: { ...next.meta, updatedAt: new Date(Date.now() + this.repo.commits * 1000 + Math.random()).toISOString() } };
  }
}

function realData(): AppData {
  const data = createEmptyData();
  data.meta.onboarded = true;
  data.user.role = 'Product designer';
  return data;
}

describe('sync engine', () => {
  it('first device uploads its data to an empty private repo', async () => {
    const repo = new FakeRepo();
    const laptop = new Device(repo, realData(), 'Laptop');
    const result = await connect(laptop.deps, 'auto');
    expect(result).toEqual({ status: 'connected', outcome: 'pushed' });
    expect(repo.files.has(DATA_PATH)).toBe(true);
    expect(laptop.config.lastRemoteSha).toBe('sha1');
  });

  it('a new device pulls the existing data automatically', async () => {
    const repo = new FakeRepo();
    const laptop = new Device(repo, realData(), 'Laptop');
    await connect(laptop.deps, 'auto');
    const phone = new Device(repo, createEmptyData(), 'Phone');
    const result = await connect(phone.deps, 'auto');
    expect(result).toEqual({ status: 'connected', outcome: 'pulled' });
    expect(phone.data.user.role).toBe('Product designer');
    expect(phone.data.meta.onboarded).toBe(true);
  });

  it('carries edits both ways and does nothing when nothing changed', async () => {
    const repo = new FakeRepo();
    const laptop = new Device(repo, realData(), 'Laptop');
    await connect(laptop.deps, 'auto');
    const phone = new Device(repo, createEmptyData(), 'Phone');
    await connect(phone.deps, 'auto');

    expect(await syncOnce(phone.deps)).toBe('unchanged');

    laptop.edit(data => toggleWeekItem(data, 1, 'learn:0'));
    expect(await syncOnce(laptop.deps)).toBe('pushed');
    expect(await syncOnce(phone.deps)).toBe('pulled');
    expect(phone.data.weeks[1].checked).toContain('learn:0');

    phone.edit(data => toggleWeekItem(data, 1, 'learn:1'));
    expect(await syncOnce(phone.deps)).toBe('pushed');
    expect(await syncOnce(laptop.deps)).toBe('pulled');
    expect(laptop.data.weeks[1].checked).toEqual(expect.arrayContaining(['learn:0', 'learn:1']));
  });

  it('when both devices edited, keeps the newer copy and saves the other', async () => {
    const repo = new FakeRepo();
    const laptop = new Device(repo, realData(), 'Laptop');
    await connect(laptop.deps, 'auto');
    const phone = new Device(repo, createEmptyData(), 'Phone');
    await connect(phone.deps, 'auto');

    laptop.edit(data => toggleWeekItem(data, 1, 'learn:0'));
    await syncOnce(laptop.deps);
    phone.edit(data => toggleWeekItem(data, 2, 'learn:0')); // edited later, offline

    expect(await syncOnce(phone.deps)).toBe('conflict-kept-local');
    expect(phone.conflicts).toHaveLength(1);
    expect(await syncOnce(laptop.deps)).toBe('pulled');
    expect(laptop.data.weeks[2].checked).toContain('learn:0');
  });

  it('retries when GitHub changed between read and write', async () => {
    const repo = new FakeRepo();
    const laptop = new Device(repo, realData(), 'Laptop');
    await connect(laptop.deps, 'auto');
    laptop.edit(data => toggleWeekItem(data, 1, 'learn:0'));
    // Another device writes right after our read.
    const originalGet = repo.getText.bind(repo);
    let first = true;
    repo.getText = async path => {
      const result = await originalGet(path);
      if (first && path === DATA_PATH && result) {
        first = false;
        const other = JSON.parse(result.text);
        other.data.user.role = 'Edited elsewhere';
        other.data.meta.updatedAt = '2000-01-01T00:00:00.000Z';
        await repo.putText(DATA_PATH, JSON.stringify(other), result.sha);
      }
      return result;
    };
    const outcome = await syncOnce(laptop.deps);
    expect(['conflict-kept-local', 'pushed']).toContain(outcome);
    expect(laptop.data.weeks[1].checked).toContain('learn:0');
  });

  it('refuses a public repository', async () => {
    const laptop = new Device(new FakeRepo(false), realData(), 'Laptop');
    await expect(connect(laptop.deps, 'auto')).rejects.toThrow(/public/);
  });

  it('never pushes demo or not-yet-onboarded data', async () => {
    const repo = new FakeRepo();
    const demo = new Device(repo, createDemoData().data, 'Laptop');
    expect(await connect(demo.deps, 'auto')).toEqual({ status: 'connected', outcome: 'empty' });
    expect(await syncOnce(demo.deps)).toBe('skipped');
    expect(repo.files.size).toBe(0);
  });

  it('asks which side wins when both already have real data', async () => {
    const repo = new FakeRepo();
    const laptop = new Device(repo, realData(), 'Laptop');
    await connect(laptop.deps, 'auto');
    const phone = new Device(repo, realData(), 'Phone');
    const result = await connect(phone.deps, 'auto');
    expect(result.status).toBe('needs-choice');
    const chosen = await connect(phone.deps, 'use-remote');
    expect(chosen).toEqual({ status: 'connected', outcome: 'pulled' });
    expect(phone.conflicts).toHaveLength(1);
  });

  it('syncs screenshots as separate files', async () => {
    const repo = new FakeRepo();
    const laptop = new Device(repo, realData(), 'Laptop');
    const build = newBuild({ name: 'Profile page', screenshotId: 'img_1' });
    laptop.data = addBuild(laptop.data, build);
    laptop.images = { img_1: 'data:image/webp;base64,UklGRg==' };
    await connect(laptop.deps, 'auto');
    expect(await repo.list(IMAGES_DIR)).toEqual(['img_1.webp']);

    const phone = new Device(repo, createEmptyData(), 'Phone');
    await connect(phone.deps, 'auto');
    expect(phone.images.img_1).toBe('data:image/webp;base64,UklGRg==');
  });
});

describe('sync config helpers', () => {
  it('parses repository input in several forms', () => {
    expect(parseRepoInput('me/level-1-data')).toEqual({ owner: 'me', repo: 'level-1-data' });
    expect(parseRepoInput('https://github.com/me/level-1-data.git')).toEqual({ owner: 'me', repo: 'level-1-data' });
    expect(parseRepoInput('nonsense')).toBeNull();
  });

  it('round-trips a pairing link without leaking into the route path', () => {
    const link = createPairingLink({ owner: 'me', repo: 'level-1-data', token: 'github_pat_ABC_123' }, 'https://me.github.io/app/#/settings');
    expect(link.startsWith('https://me.github.io/app/#/connect/')).toBe(true);
    const encoded = link.split('#/connect/')[1];
    expect(encoded).not.toMatch(/[/+=]/);
    expect(readPairingPayload(encoded)).toEqual({ owner: 'me', repo: 'level-1-data', token: 'github_pat_ABC_123' });
    expect(readPairingPayload('garbage')).toBeNull();
  });
});
