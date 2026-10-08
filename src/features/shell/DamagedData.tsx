import { useRef, useState } from 'react';
import type { AppData, ImageMap } from '../../types';
import { Button } from '../../components/ui';
import { parseBackup } from '../../lib/backup';
import { downloadText, readFileText } from '../../lib/files';
import { DataError } from '../../lib/normalize';
import { createDemoData } from '../../lib/demo';
import { createEmptyData } from '../../lib/schema';

/** Shown instead of the app when saved data can't be read. Nothing is overwritten until the learner chooses. */
export function DamagedData({
  rawText,
  reason,
  recover,
}: {
  rawText: string;
  reason: string;
  recover: (data: AppData, images: ImageMap) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseBackup(await readFileText(file));
      await recover(parsed.data, parsed.images);
    } catch (problem) {
      setError(problem instanceof DataError ? `Import failed: ${problem.message}` : 'Import failed. The file could not be read.');
    }
  };

  return (
    <main className="recovery" id="main">
      <div className="recovery__panel">
        <p className="eyebrow">Data check</p>
        <h1>We found an issue with your local data.</h1>
        <p className="lede">{reason} Your last export can be restored. The damaged copy is kept and won’t be deleted.</p>
        <ol className="recovery__steps">
          <li>
            <strong>Save the damaged copy</strong> (useful if you want to repair it by hand).
            <Button size="sm" icon="download" onClick={() => downloadText(`level1-damaged-${Date.now()}.json`, rawText || '{}')}>
              Download damaged data
            </Button>
          </li>
          <li>
            <strong>Restore your last backup.</strong>
            <input ref={input} type="file" accept="application/json,.json" hidden onChange={event => restore(event.target.files?.[0])} />
            <Button size="sm" variant="primary" icon="upload" onClick={() => input.current?.click()}>
              Restore from backup
            </Button>
          </li>
          <li>
            <strong>Or start again</strong>, with the demo or a blank plan.
            <span className="button-row">
              <Button size="sm" onClick={() => { const demo = createDemoData(); void recover(demo.data, demo.images); }}>Load demo</Button>
              <Button size="sm" variant="ghost" onClick={() => void recover(createEmptyData(), {})}>Start fresh</Button>
            </span>
          </li>
        </ol>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </main>
  );
}
