import { useState } from 'react';
import { Button, ConfirmDialog } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { createEmptyData } from '../../lib/schema';
import { useStore } from '../../store/store';
import { useUi } from './ui-context';

/** System-level problems the learner must know about. Never silent. */
export function StatusBanners() {
  const { data, saveError, storageMode, changedElsewhere, replaceAll } = useStore();
  const ui = useUi();
  const [confirmFresh, setConfirmFresh] = useState(false);

  return (
    <div className="banners">
      {changedElsewhere && (
        <div className="banner banner--attention" role="alert">
          <Icon name="alert" />
          <p>Level 1 was changed in another tab. Saving here is paused so nothing gets overwritten.</p>
          <Button size="sm" variant="primary" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      )}
      {saveError && (
        <div className="banner banner--attention" role="alert">
          <Icon name="alert" />
          <p>{saveError}</p>
          <Button size="sm" variant="primary" icon="download" onClick={ui.exportBackup}>Export backup</Button>
        </div>
      )}
      {storageMode === 'memory' && (
        <div className="banner banner--attention" role="alert">
          <Icon name="alert" />
          <p>Local storage is unavailable. Your work lasts only until this tab closes. Export your data and use backup mode.</p>
          <Button size="sm" variant="primary" icon="download" onClick={ui.exportBackup}>Export backup</Button>
        </div>
      )}
      {storageMode === 'localstorage' && (
        <div className="banner" role="status">
          <Icon name="alert" />
          <p>Using basic browser storage (IndexedDB isn’t available here). Screenshots may not fit. Export regularly.</p>
        </div>
      )}
      {data.meta.isDemo && (
        <div className="banner banner--demo" role="status">
          <p>
            <strong>Demo data.</strong> You’re exploring a sample learner in Week 3. Nothing here is yours yet.
          </p>
          <Button size="sm" variant="primary" onClick={() => setConfirmFresh(true)}>Start my own plan</Button>
        </div>
      )}
      {confirmFresh && (
        <ConfirmDialog
          title="Start your own plan?"
          body={<p>This clears the demo data and takes you through a short setup. You can reload the demo any time from Settings.</p>}
          confirmLabel="Start fresh"
          onCancel={() => setConfirmFresh(false)}
          onConfirm={async () => {
            setConfirmFresh(false);
            await replaceAll(createEmptyData(), {});
            window.location.hash = '#/dashboard';
          }}
        />
      )}
    </div>
  );
}
