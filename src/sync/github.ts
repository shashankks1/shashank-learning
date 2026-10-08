/*
 * Minimal GitHub REST client for syncing: read/write files in one private repo.
 * Talks to api.github.com directly from the browser (it supports CORS) with a
 * fine-grained token scoped to that single repo.
 */

export interface RepoRef {
  owner: string;
  repo: string;
  token: string;
  /** Overridable for tests; defaults to the real API. */
  apiBase?: string;
}

export interface RemoteText {
  sha: string;
  text: string;
}

export interface RepoInfo {
  fullName: string;
  isPrivate: boolean;
  canPush: boolean;
}

/** The file changed on GitHub since we last read it. */
export class SyncConflictError extends Error {}

/** A problem worth showing the learner, in plain words. */
export class SyncError extends Error {
  constructor(message: string, readonly kind: 'auth' | 'not-found' | 'offline' | 'rate-limit' | 'other' = 'other') {
    super(message);
  }
}

export interface GitHubClient {
  repoInfo(): Promise<RepoInfo>;
  getText(path: string): Promise<RemoteText | null>;
  putText(path: string, text: string, sha: string | null, message: string): Promise<string>;
  getBase64(path: string): Promise<string | null>;
  putBase64(path: string, base64: string, message: string): Promise<void>;
  list(dir: string): Promise<string[]>;
}

/* ---------- base64 that is safe for UTF-8 and binary ---------- */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const textToBase64 = (text: string) => bytesToBase64(new TextEncoder().encode(text));
export const base64ToText = (base64: string) => new TextDecoder().decode(base64ToBytes(base64));

/* ---------- client ---------- */

export function createGitHubClient(ref: RepoRef, fetcher: typeof fetch = fetch.bind(globalThis)): GitHubClient {
  const base = (ref.apiBase ?? 'https://api.github.com').replace(/\/$/, '');
  const repoPath = `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, {
        ...init,
        cache: 'no-store', // GitHub responses are cacheable for 60s; a stale sha would cause false conflicts
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${ref.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new SyncError('Can’t reach GitHub. You may be offline; changes will sync when you’re back.', 'offline');
    }
    if (response.status === 401) throw new SyncError('GitHub rejected the token. It may have expired; create a new one and reconnect.', 'auth');
    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      throw new SyncError('GitHub’s rate limit was reached. Sync will retry shortly.', 'rate-limit');
    }
    if (response.status === 403) throw new SyncError('The token doesn’t have permission for this repository. It needs Contents: Read and write.', 'auth');
    return response;
  }

  const contentsPath = (path: string) => `${repoPath}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

  async function getContent(path: string): Promise<{ sha: string; content: string } | null> {
    const response = await request(contentsPath(path));
    if (response.status === 404) return null;
    if (!response.ok) throw new SyncError(`GitHub returned ${response.status} while reading ${path}.`);
    const body = (await response.json()) as { sha: string; content?: string; encoding?: string; type?: string };
    if (body.type && body.type !== 'file') throw new SyncError(`${path} on GitHub is not a file.`);
    let content = body.content ?? '';
    // Files over 1 MB come back without content; fetch the blob instead.
    if (!content || body.encoding === 'none') {
      const blob = await request(`${repoPath}/git/blobs/${body.sha}`);
      if (!blob.ok) throw new SyncError(`GitHub returned ${blob.status} while reading a large file.`);
      content = ((await blob.json()) as { content: string }).content;
    }
    return { sha: body.sha, content };
  }

  async function putContent(path: string, base64: string, sha: string | null, message: string): Promise<string> {
    const response = await request(contentsPath(path), {
      method: 'PUT',
      body: JSON.stringify({ message, content: base64, ...(sha ? { sha } : {}) }),
    });
    if (response.status === 409 || response.status === 422) throw new SyncConflictError('The file changed on GitHub.');
    if (response.status === 404) throw new SyncError('Repository not found. Check the name, and that the token can access it.', 'not-found');
    if (!response.ok) throw new SyncError(`GitHub returned ${response.status} while saving.`);
    const body = (await response.json()) as { content: { sha: string } };
    return body.content.sha;
  }

  return {
    async repoInfo() {
      const response = await request(repoPath);
      if (response.status === 404) throw new SyncError('Repository not found. Check the owner/name, and that the token was given access to it.', 'not-found');
      if (!response.ok) throw new SyncError(`GitHub returned ${response.status}.`);
      const body = (await response.json()) as { full_name: string; private: boolean; permissions?: { push?: boolean } };
      return { fullName: body.full_name, isPrivate: body.private, canPush: Boolean(body.permissions?.push) };
    },
    async getText(path) {
      const file = await getContent(path);
      return file ? { sha: file.sha, text: base64ToText(file.content) } : null;
    },
    async putText(path, text, sha, message) {
      return putContent(path, textToBase64(text), sha, message);
    },
    async getBase64(path) {
      const file = await getContent(path);
      return file ? file.content.replace(/\s/g, '') : null;
    },
    async putBase64(path, base64, message) {
      await putContent(path, base64, null, message).catch(error => {
        // Already uploaded (image ids are unique and immutable): fine.
        if (error instanceof SyncConflictError) return '';
        throw error;
      });
    },
    async list(dir) {
      const response = await request(contentsPath(dir));
      if (response.status === 404) return [];
      if (!response.ok) throw new SyncError(`GitHub returned ${response.status} while listing ${dir}.`);
      const body = (await response.json()) as { name: string; type: string }[];
      return Array.isArray(body) ? body.filter(item => item.type === 'file').map(item => item.name) : [];
    },
  };
}
