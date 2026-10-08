import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Button, Card, ConfirmDialog, Dialog, ExternalLink, TextField } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { formatAgo, formatDateLong } from '../../lib/dates';
import { downloadText } from '../../lib/files';
import type { Snapshot } from '../../lib/storage';
import { useStore } from '../../store/store';
import { useTick } from '../../hooks';
import { createPairingLink, parseRepoInput } from '../../sync/config';
import { SyncError } from '../../sync/github';
import type { ConnectResult } from '../../sync/engine';
import { useSync } from '../../sync/SyncProvider';

const NEW_REPO_URL = 'https://github.com/new?name=level-1-data&visibility=private&description=Private%20data%20for%20Level%201';
const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

/* ---------- Connect form (Settings + onboarding) ---------- */

export function ConnectForm({ onConnected, compact = false, initial }: { onConnected?: () => void; compact?: boolean; initial?: { repo?: string; token?: string } }) {
  const { connect } = useSync();
  const toast = useToast();
  const [repoInput, setRepoInput] = useState(initial?.repo ?? '');
  const [token, setToken] = useState(initial?.token ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<Extract<ConnectResult, { status: 'needs-choice' }> | null>(null);
  const repo = parseRepoInput(repoInput);

  const run = async (strategy: 'auto' | 'use-remote' | 'use-local') => {
    if (!repo || !token.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await connect({ ...repo, token }, strategy);
      if (result.status === 'needs-choice') {
        setChoice(result);
      } else {
        setChoice(null);
        toast(
          result.outcome === 'pulled' ? 'Connected. Your data from GitHub is on this device.' : result.outcome === 'pushed' ? 'Connected. This device’s data is now on GitHub.' : 'Connected. Sync starts once you’ve set up your plan.',
          'success',
        );
        onConnected?.();
      }
    } catch (problem) {
      setError(problem instanceof SyncError ? problem.message : 'Could not connect. Check the repository name and token.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="connect-form">
      {!compact && (
        <ol className="setup-steps">
          <li>
            <strong>Create a private repository</strong> for your data, e.g. <code>level-1-data</code>. Keep it private: it will hold your income and notes.
            <ExternalLink href={NEW_REPO_URL}>Create it on GitHub</ExternalLink>
          </li>
          <li>
            <strong>Create a fine-grained token</strong>: Repository access → <em>Only select repositories</em> → your data repo. Permissions → <em>Contents: Read and write</em>. Pick an expiry you’re comfortable with (you’ll reconnect when it expires).
            <ExternalLink href={NEW_TOKEN_URL}>Create a token</ExternalLink>
          </li>
          <li><strong>Paste both below.</strong> On your other devices, use “Connect another device” instead of repeating this.</li>
        </ol>
      )}
      <div className="form-grid form-grid--2">
        <TextField
          label="Data repository"
          value={repoInput}
          onChange={setRepoInput}
          placeholder="your-username/level-1-data"
          hint={repoInput && !repo ? 'Use the form owner/name, e.g. shashankks1/level-1-data' : undefined}
        />
        <div className="field">
          <label htmlFor="sync-token">Token</label>
          <input id="sync-token" type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} placeholder="github_pat_…" />
          <p className="field__hint">Stored only on this device. Never exported, never synced.</p>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button variant="primary" icon="upload" onClick={() => run('auto')} disabled={!repo || !token.trim() || busy}>
        {busy ? 'Connecting…' : 'Connect and sync'}
      </Button>

      {choice && (
        <Dialog
          title="Which data should this device use?"
          size="sm"
          onClose={() => setChoice(null)}
          footer={<Button variant="ghost" onClick={() => setChoice(null)}>Cancel</Button>}
        >
          <p>Both this device and GitHub already have Level 1 data. Pick one to keep. The other is saved as a copy in Settings, never deleted.</p>
          <div className="choice-grid">
            <button type="button" className="choice" onClick={() => run('use-remote')} disabled={busy}>
              <span className="choice__title">Use the data on GitHub</span>
              <span className="choice__body">
                Saved {choice.remoteSavedAt ? formatDateLong(choice.remoteSavedAt) : 'earlier'}{choice.remoteDevice ? ` from ${choice.remoteDevice}` : ''} · {choice.remoteWeeksClosed} week(s) closed. Replaces this device’s data.
              </span>
            </button>
            <button type="button" className="choice" onClick={() => run('use-local')} disabled={busy}>
              <span className="choice__title">Use this device’s data</span>
              <span className="choice__body">Uploads this device’s data and replaces the copy on GitHub.</span>
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/* ---------- Settings panel ---------- */

export function SyncPanel() {
  const { status, config, dirty, disconnect, syncNow, renameDevice } = useSync();
  const { snapshots } = useStore();
  const [pairing, setPairing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [copies, setCopies] = useState<Snapshot[]>([]);

  useEffect(() => {
    let cancelled = false;
    snapshots.list().then(list => {
      if (!cancelled) setCopies([...list].sort((a, b) => b.key.localeCompare(a.key)));
    });
    return () => {
      cancelled = true;
    };
  }, [snapshots, status.lastSyncedAt]);

  return (
    <Card label="Sync across devices" title={config ? 'Automatic sync is on' : 'Use Level 1 on your phone and laptop'} className="sync-panel">
      {!config ? (
        <>
          <p className="card__note">Each browser keeps its own copy. Sync keeps them in step automatically through a <strong>private</strong> GitHub repository you own. Nothing goes to the public app repo.</p>
          <ConnectForm />
        </>
      ) : (
        <>
          <SyncStatusBadge />
          <dl className="about">
            <div><dt>Repository</dt><dd className="mono">{config.owner}/{config.repo} (private)</dd></div>
            <div><dt>This device</dt><dd><DeviceName value={config.device} onSave={renameDevice} /></dd></div>
            <div><dt>Last synced</dt><dd className="mono">{status.lastSyncedAt ? `${formatAgo(status.lastSyncedAt)} · ${formatDateLong(status.lastSyncedAt)}` : 'not yet'}{dirty ? ' · changes waiting' : ''}</dd></div>
          </dl>
          {status.message && <p className={status.phase === 'error' ? 'form-error' : 'warn-text'} role="status">{status.message}</p>}
          <div className="button-row">
            <Button variant="primary" icon="upload" onClick={() => void syncNow()} disabled={status.phase === 'syncing'}>Sync now</Button>
            <Button icon="globe" onClick={() => setPairing(true)}>Connect another device</Button>
            <Button variant="ghost" onClick={() => setConfirmDisconnect(true)}>Disconnect this device</Button>
          </div>
          <p className="field__hint">Syncs on open, when you return to the app, a few seconds after you stop editing, and every 2 minutes while open. Every sync is a commit in your data repo, so GitHub also keeps a full history.</p>
        </>
      )}

      {copies.length > 0 && (
        <details className="sync-copies">
          <summary>Saved copies ({copies.length})</summary>
          <p className="field__hint">Kept when edits collided between devices, when you chose one device’s data over another, or when stored data was unreadable. Download one to import it in Settings → Import.</p>
          <ul className="plain-list">
            {copies.map(copy => (
              <li key={copy.key} className="sync-copies__row">
                <span className="mono">{describeCopy(copy.key)}</span>
                <button type="button" className="text-btn" onClick={() => downloadText(`level1-${copy.key}.json`, wrapAsBackup(copy.text))}>Download</button>
                <button type="button" className="text-btn" onClick={async () => { await snapshots.remove(copy.key); setCopies(list => list.filter(item => item.key !== copy.key)); }}>Delete</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {pairing && config && <PairingDialog onClose={() => setPairing(false)} />}
      {confirmDisconnect && (
        <ConfirmDialog
          title="Disconnect this device?"
          body={<p>Sync stops on this device and its token is forgotten. Your data stays here and on GitHub; nothing is deleted.</p>}
          confirmLabel="Disconnect"
          onCancel={() => setConfirmDisconnect(false)}
          onConfirm={() => { disconnect(); setConfirmDisconnect(false); }}
        />
      )}
    </Card>
  );
}

function describeCopy(key: string): string {
  const stamp = Number(key.match(/(\d{12,})$/)?.[1]);
  const when = Number.isFinite(stamp) ? new Date(stamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const kind = key.startsWith('conflict-local') ? 'This device’s version (collision)'
    : key.startsWith('conflict-remote') ? 'Other device’s version (collision)'
    : key.startsWith('before-connect') ? 'This device before connecting'
    : key.startsWith('remote-before-connect') ? 'GitHub copy before connecting'
    : key.startsWith('damaged') ? 'Unreadable data'
    : key;
  return `${kind}${when ? ` · ${when}` : ''}`;
}

/** Saved copies are raw AppData (or sync files); wrap them so Import accepts them. */
function wrapAsBackup(text: string): string {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const data = parsed.format === 'level1-sync' ? parsed.data : parsed;
    return JSON.stringify({ format: 'level1-builder-backup', app: 'Level 1 — Product-Minded AI Builder', schemaVersion: 2, exportedAt: new Date().toISOString(), data, images: {} }, null, 2);
  } catch {
    return text;
  }
}

function DeviceName({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      className="inline-input"
      aria-label="Device name"
      value={draft}
      onChange={event => setDraft(event.target.value)}
      onBlur={() => draft.trim() && draft.trim() !== value && onSave(draft.trim())}
    />
  );
}

/* ---------- Pairing: QR + link ---------- */

function PairingDialog({ onClose }: { onClose: () => void }) {
  const { config } = useSync();
  const toast = useToast();
  const [svg, setSvg] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const link = config ? createPairingLink(config, window.location.href) : '';

  useEffect(() => {
    if (!reveal || !link) return;
    let cancelled = false;
    import('qrcode-generator').then(module => {
      if (cancelled) return;
      const qrcode = module.default;
      const code = qrcode(0, 'M');
      code.addData(link);
      code.make();
      setSvg(qrToSvg(code));
    });
    return () => {
      cancelled = true;
    };
  }, [reveal, link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied. Treat it like a password.', 'success');
    } catch {
      toast('Could not copy. Long-press the QR code’s link instead.', 'error');
    }
  };

  return (
    <Dialog
      title="Connect another device"
      size="sm"
      onClose={onClose}
      footer={<Button variant="ghost" onClick={onClose}>Done</Button>}
    >
      <p>Scan this with your phone’s camera (or open the link on the other device). It connects in one tap and pulls your data.</p>
      <p className="warn-text"><Icon name="alert" size={14} /> The code contains your token. Don’t share it or screenshot it. If it leaks, delete the token on GitHub and make a new one.</p>
      {!reveal ? (
        <Button variant="primary" onClick={() => setReveal(true)}>Show code</Button>
      ) : (
        <>
          <div className="qr" aria-label="QR code for connecting another device" role="img" dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
          <Button size="sm" onClick={copy}>Copy link instead</Button>
        </>
      )}
    </Dialog>
  );
}

function qrToSvg(code: { getModuleCount(): number; isDark(row: number, col: number): boolean }): string {
  const count = code.getModuleCount();
  const margin = 4;
  const size = count + margin * 2;
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (code.isDark(row, col)) path += `M${col + margin},${row + margin}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#ffffff"/><path d="${path}" fill="#16171b"/></svg>`;
}

/* ---------- Compact status (sidebar, drawer) ---------- */

export function SyncStatusBadge({ compact = false }: { compact?: boolean }) {
  const { status, config, dirty } = useSync();
  useTick(30_000, Boolean(config));
  if (!config) return null;
  const label =
    status.phase === 'syncing' ? 'Syncing…'
    : status.phase === 'offline' ? 'Offline: will sync later'
    : status.phase === 'error' ? 'Sync problem'
    : dirty ? 'Changes waiting to sync'
    : status.lastSyncedAt ? `Synced ${formatAgo(status.lastSyncedAt)}`
    : 'Sync on';
  return (
    <a
      className={`sync-badge sync-badge--${status.phase} ${dirty && status.phase === 'idle' ? 'sync-badge--pending' : ''} ${compact ? 'sync-badge--compact' : ''}`}
      href="#/settings"
      title={status.message ?? label}
      aria-label={compact ? `Sync: ${label}` : undefined}
    >
      <span className="sync-badge__dot" aria-hidden="true" />
      <span className={compact ? 'visually-hidden' : undefined}>{label}</span>
    </a>
  );
}

/** Shown app-wide only when sync has actually stopped and needs a person. Never for brief offline moments. */
export function SyncProblemBanner() {
  const { status, config, syncNow } = useSync();
  if (!config || status.phase !== 'error') return null;
  return (
    <div className="banner banner--attention" role="alert">
      <Icon name="alert" />
      <p><strong>Sync has stopped.</strong> {status.message} Your work is safe on this device in the meantime.</p>
      <Button size="sm" onClick={() => void syncNow()}>Try again</Button>
      <a className="btn btn--primary btn--sm" href="#/settings">Fix in Settings</a>
    </div>
  );
}
