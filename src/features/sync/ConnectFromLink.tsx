import { useEffect, useState } from 'react';
import { Mark } from '../../components/Mark';
import { Button, LinkButton } from '../../components/ui';
import { readPairingPayload } from '../../sync/config';
import { useSync } from '../../sync/SyncProvider';
import { ConnectForm } from './SyncPanel';

/**
 * Opened from a pairing QR code / link (#/connect/<payload>). The token is read once,
 * then removed from the address bar and history straight away.
 */
export function ConnectFromLink({ encoded }: { encoded: string | undefined }) {
  const { config } = useSync();
  const [payload] = useState(() => (encoded ? readPairingPayload(encoded) : null));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (encoded) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/connect`);
  }, [encoded]);

  const finish = () => {
    setDone(true);
    window.location.hash = '#/dashboard';
  };

  return (
    <main className="onboarding" id="main">
      <div className="onboarding__frame">
        <span className="brand">
          <Mark className="brand__mark" />
          <span className="brand__text">
            <span className="brand__name">Level 1</span>
            <span className="brand__sub">Connect this device</span>
          </span>
        </span>
        {done || (config && !payload) ? (
          <section className="onboarding__screen">
            <h1 className="onboarding__title onboarding__title--sm">This device is connected.</h1>
            <LinkButton href="#/dashboard" variant="primary">Open Level 1</LinkButton>
          </section>
        ) : payload ? (
          <section className="onboarding__screen">
            <p className="onboarding__index">Sync</p>
            <h1 className="onboarding__title onboarding__title--sm">
              {payload.token ? `Connect to your data in ${payload.owner}/${payload.repo}?` : `Paste your sync token to connect ${payload.owner}/${payload.repo}`}
            </h1>
            <p className="onboarding__body">
              {payload.token
                ? 'Your progress will download to this device and stay in sync with your other devices. The token is stored only in this browser.'
                : 'Paste the token you just generated on GitHub (it starts with github_pat_). It’s stored only in this browser, never exported or synced.'}
            </p>
            <ConnectForm compact initial={{ repo: `${payload.owner}/${payload.repo}`, token: payload.token }} onConnected={finish} />
          </section>
        ) : (
          <section className="onboarding__screen">
            <h1 className="onboarding__title onboarding__title--sm">That link didn’t work.</h1>
            <p className="onboarding__body">It may be incomplete. On your other device, open Settings → Sync → Connect another device, and scan the code again. Or enter the repository and token by hand:</p>
            <ConnectForm compact onConnected={finish} />
            <Button variant="ghost" onClick={() => (window.location.hash = '#/dashboard')}>Skip for now</Button>
          </section>
        )}
      </div>
    </main>
  );
}
