import { useRef, useState } from 'react';
import { SCHEMA_VERSION, type ActivityType, type Settings, type TechnicalLevel, type ThemeSetting } from '../../types';
import { curriculum } from '../../curriculum';
import { Button, Card, Checkbox, ConfirmDialog, Dialog, NumberField, PageHeader, Segmented, SelectField, TextArea, TextField } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { ACTIVITY_LABELS } from '../../lib/activity';
import { parseBackup, type ParsedBackup } from '../../lib/backup';
import { formatDateLong } from '../../lib/dates';
import { createDemoData } from '../../lib/demo';
import { readFileText } from '../../lib/files';
import { TECH_LEVEL_LABELS } from '../../lib/labels';
import { DataError } from '../../lib/normalize';
import { ACTIVITY_TYPES, createEmptyData } from '../../lib/schema';
import { useStore } from '../../store/store';
import { useUi } from '../shell/ui-context';
import { SyncPanel } from '../sync/SyncPanel';

export default function SettingsPage() {
  const { data, update, storageMode, replaceAll } = useStore();
  const ui = useUi();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'demo' | 'fresh' | null>(null);

  const setSettings = (change: Partial<Settings>) => update(current => ({ ...current, settings: { ...current.settings, ...change } }));
  const setUser = (change: Partial<typeof data.user>) => update(current => ({ ...current, user: { ...current.user, ...change } }));

  const chooseFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setImportError(null);
    try {
      setPending(parseBackup(await readFileText(file)));
    } catch (error) {
      setImportError(`Import failed. Your existing data has not been changed. ${error instanceof DataError ? error.message : 'The file could not be read.'}`);
    }
  };

  const importNow = async () => {
    if (!pending) return;
    try {
      await replaceAll(pending.data, pending.images);
      toast(pending.source === 'legacy-v1' ? 'v1 backup imported' : 'Backup imported', 'success');
      setPending(null);
    } catch {
      setImportError('Import failed while saving. Your existing data has not been changed.');
      setPending(null);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Settings" title="Data and preferences" lede="Everything lives in this browser on this device. Export to move it, back it up, or keep a copy outside the browser." />

      <div className="settings-grid">
        <div id="sync" className="settings-grid__wide">
          <SyncPanel />
        </div>
        <Card label="Backup & restore" title="Your data, portable">
          <p className="card__note">
            Last export: <strong>{data.meta.lastExportAt ? formatDateLong(data.meta.lastExportAt) : 'never'}</strong>. Backups are JSON files. Keep them in the repo’s <code>backups/</code> folder (git-ignored) or anywhere outside the browser.
          </p>
          <div className="button-row">
            <Button variant="primary" icon="download" onClick={ui.exportBackup}>Export data</Button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={event => chooseFile(event.target.files?.[0])} />
            <Button icon="upload" onClick={() => fileInput.current?.click()}>Import data</Button>
          </div>
          {importError && <p className="form-error" role="alert">{importError}</p>}
          <NumberField label="Remind me to back up after" suffix="days" value={data.settings.backupReminderDays} onChange={value => { if (value !== null && value >= 1) setSettings({ backupReminderDays: Math.round(value) }); }} min={1} />
          <Checkbox checked={data.settings.includeFinancialInExport} onChange={includeFinancialInExport => setSettings({ includeFinancialInExport })}>
            Include income and savings figures in exports
          </Checkbox>
          <p className="field__hint">Turn this off if a backup might end up somewhere shared. Imports of such backups leave those fields empty.</p>
          <p className="field__hint">Also imports backups from the original v1 curriculum page.</p>
        </Card>

        <Card label="Profile">
          <TextField label="Current role" value={data.user.role} onChange={role => setUser({ role })} />
          <SelectField<TechnicalLevel> label="Technical level" value={data.user.technicalLevel} onChange={technicalLevel => setUser({ technicalLevel })} options={(Object.keys(TECH_LEVEL_LABELS) as TechnicalLevel[]).map(value => ({ value, label: TECH_LEVEL_LABELS[value] }))} />
          <TextArea label="Primary goal" value={data.user.primaryGoal} onChange={primaryGoal => setUser({ primaryGoal })} rows={2} />
        </Card>

        <Card label="Weekly rhythm">
          <div className="form-grid form-grid--2">
            <NumberField label="Weekly target, low" suffix="h" value={data.settings.weeklyTargetMin} onChange={value => { if (value !== null && value >= 1) setSettings({ weeklyTargetMin: value }); }} min={1} />
            <NumberField label="Weekly target, high" suffix="h" value={data.settings.weeklyTargetMax} onChange={value => { if (value !== null && value >= 1) setSettings({ weeklyTargetMax: value }); }} min={1} />
          </div>
          {data.settings.weeklyTargetMax < data.settings.weeklyTargetMin && <p className="warn-text">The high target is below the low one.</p>}
          <p className="field__hint">The default is 6–8h. A 4-hour minimum week is always allowed.</p>
          <p className="field__hint">Plan started {formatDateLong(data.curriculum.startDate)} · {data.curriculum.rebases.length} rebase{data.curriculum.rebases.length === 1 ? '' : 's'} recorded.</p>
        </Card>

        <Card label="What counts toward your streak">
          <p className="card__note">A streak is consecutive days with at least one meaningful action. Choose what counts.</p>
          <div className="check-grid">
            {ACTIVITY_TYPES.map((type: ActivityType) => (
              <Checkbox key={type} checked={data.settings.streakTypes[type]} onChange={checked => setSettings({ streakTypes: { ...data.settings.streakTypes, [type]: checked } })}>
                {ACTIVITY_LABELS[type]}
              </Checkbox>
            ))}
          </div>
        </Card>

        <Card label="Appearance & accessibility">
          <Segmented<ThemeSetting>
            label="Theme"
            value={data.settings.theme}
            onChange={theme => setSettings({ theme })}
            options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          />
          <Checkbox checked={data.settings.reduceMotion} onChange={reduceMotion => setSettings({ reduceMotion })}>
            Reduce motion (your system setting is also respected)
          </Checkbox>
          <Checkbox checked={data.settings.hideFinancials} onChange={hideFinancials => setSettings({ hideFinancials })}>
            Hide money amounts on screen
          </Checkbox>
          {data.settings.dismissed.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSettings({ dismissed: [] })}>Show dismissed reminders again</Button>
          )}
        </Card>

        <Card label="Start over" title="Demo and fresh starts">
          <p className="card__note">Both replace what’s in this browser. Export first if there’s anything you want to keep.</p>
          <div className="button-col">
            <Button onClick={() => setConfirm('demo')}>Reset demo data</Button>
            <Button variant="danger" onClick={() => setConfirm('fresh')}>Start fresh</Button>
          </div>
        </Card>

        <Card label="About">
          <dl className="about">
            <div><dt>Schema version</dt><dd className="mono">{SCHEMA_VERSION}</dd></div>
            <div><dt>Curriculum</dt><dd className="mono">{curriculum.version} · {curriculum.weeks.length} weeks · {curriculum.mastery.length} mastery tests</dd></div>
            <div><dt>Storage</dt><dd className="mono">{storageMode === 'indexeddb' ? 'IndexedDB (this browser)' : storageMode === 'localstorage' ? 'localStorage (basic)' : 'Memory only: export now'}</dd></div>
            <div><dt>Records</dt><dd className="mono">{data.builds.length} builds · {data.buildLog.length} log entries · {data.opportunities.length} opportunities · {data.sessions.length} sessions</dd></div>
          </dl>
          <button type="button" className="text-btn" onClick={() => ui.openHelp()}>Keyboard shortcuts</button>
        </Card>
      </div>

      {pending && (
        <Dialog
          title="Import this backup?"
          size="sm"
          onClose={() => setPending(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
              <Button onClick={ui.exportBackup} icon="download">Export backup</Button>
              <Button variant="primary" onClick={importNow}>Import anyway</Button>
            </>
          }
        >
          <p><strong>This will replace your current local data.</strong> Export a backup first?</p>
          <ul className="plain-list bullets">
            <li>Backup from: {pending.exportedAt ? formatDateLong(pending.exportedAt) : 'unknown date'}{pending.source === 'legacy-v1' ? ' (v1 curriculum page)' : ''}</li>
            <li>{pending.data.builds.length} builds · {pending.data.buildLog.length} log entries · {pending.data.opportunities.length} opportunities · {Object.values(pending.data.weeks).filter(week => week.completedAt).length} weeks closed</li>
            {pending.warnings.map(warning => <li key={warning} className="warn-text">{warning}</li>)}
          </ul>
        </Dialog>
      )}

      {confirm === 'demo' && (
        <ConfirmDialog
          title="Reset to demo data?"
          body={<p>This replaces everything in this browser with the sample learner in Week 3. Your current data is lost unless you’ve exported it.</p>}
          confirmLabel="Reset demo data"
          danger={!data.meta.isDemo}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const demo = createDemoData();
            await replaceAll(demo.data, demo.images);
            setConfirm(null);
            toast('Demo data loaded');
            window.location.hash = '#/dashboard';
          }}
        />
      )}
      {confirm === 'fresh' && (
        <ConfirmDialog
          title="Start fresh?"
          body={<p>This erases everything in this browser and starts the setup again. Export first if you want to keep anything.</p>}
          confirmLabel="Erase and start fresh"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await replaceAll(createEmptyData(), {});
            setConfirm(null);
            window.location.hash = '#/dashboard';
          }}
        />
      )}
    </>
  );
}
