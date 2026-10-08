import { useState } from 'react';
import type { SessionType } from '../../types';
import { curriculum } from '../../curriculum';
import { useToast } from '../../components/Toast';
import { Button, Dialog, NumberField, SelectField, TextArea, TextField } from '../../components/ui';
import { useTick } from '../../hooks';
import { addSession, cancelSession, startSession, stopSession } from '../../store/actions';
import { useStore } from '../../store/store';
import { formatClock, formatMinutes, today } from '../../lib/dates';
import { SESSION_TYPE_LABELS } from '../../lib/labels';
import { currentWeekNumber } from '../../lib/progress';
import { useUi } from './ui-context';

const SESSION_OPTIONS = (Object.keys(SESSION_TYPE_LABELS) as SessionType[]).map(value => ({ value, label: SESSION_TYPE_LABELS[value] }));

/** The always-visible timer: start, see elapsed time, stop to log. */
export function SessionTimer({ compact = false }: { compact?: boolean }) {
  const { data, update } = useStore();
  const ui = useUi();
  const toast = useToast();
  const active = data.activeSession;
  useTick(1000, Boolean(active));

  if (!active) {
    return (
      <div className={`timer ${compact ? 'timer--compact' : ''}`}>
        <Button variant="secondary" icon="play" size={compact ? 'sm' : undefined} onClick={() => ui.openStartSession()}>
          Start session
        </Button>
        {!compact && (
          <button type="button" className="text-btn" onClick={() => ui.openLogTime()}>
            Log time manually
          </button>
        )}
      </div>
    );
  }

  const seconds = (Date.now() - new Date(active.start).getTime()) / 1000;
  const stop = () => {
    const minutes = Math.round(seconds / 60);
    update(current => stopSession(current));
    toast(minutes >= 1 ? `Logged ${formatMinutes(minutes)} of ${SESSION_TYPE_LABELS[active.type].toLowerCase()}` : 'Session under a minute, so it wasn’t logged', minutes >= 1 ? 'success' : 'neutral');
  };

  return (
    <div className={`timer timer--running ${compact ? 'timer--compact' : ''}`} aria-live="off">
      <div className="timer__readout">
        <span className="timer__dot" aria-hidden="true" />
        <span className="timer__clock" aria-label="Elapsed time">{formatClock(seconds)}</span>
        {!compact && (
          <span className="timer__meta">
            {SESSION_TYPE_LABELS[active.type]}
            {active.week ? ` · W${active.week}` : ''}
          </span>
        )}
      </div>
      <div className="timer__actions">
        <Button variant="primary" size="sm" icon="stop" onClick={stop}>Stop &amp; log</Button>
        {!compact && (
          <button type="button" className="text-btn" onClick={() => update(cancelSession)}>
            Discard
          </button>
        )}
      </div>
    </div>
  );
}

export function StartSessionDialog({ onClose, preset }: { onClose: () => void; preset?: { week?: number | null; buildId?: string | null } }) {
  const { data, update } = useStore();
  const [type, setType] = useState<SessionType>('learn');
  const [week, setWeek] = useState<string>(String(preset?.week ?? currentWeekNumber(data)));
  const [buildId, setBuildId] = useState<string>(preset?.buildId ?? '');

  const start = () => {
    update(current => startSession(current, { type, week: week ? Number(week) : null, buildId: buildId || null }));
    onClose();
  };

  return (
    <Dialog
      title="Start a session"
      size="sm"
      onClose={onClose}
      description="Time is tracked locally. Stop the timer when you finish to log it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="play" onClick={start}>Start</Button>
        </>
      }
    >
      <div className="form-grid">
        <SelectField<SessionType> label="What kind of work?" value={type} onChange={setType} options={SESSION_OPTIONS} />
        <WeekSelect value={week} onChange={setWeek} />
        <BuildSelect value={buildId} onChange={setBuildId} />
      </div>
    </Dialog>
  );
}

export function LogTimeDialog({ onClose, preset }: { onClose: () => void; preset?: { week?: number | null; buildId?: string | null } }) {
  const { data, update } = useStore();
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState('19:00');
  const [minutes, setMinutes] = useState<number | null>(60);
  const [type, setType] = useState<SessionType>('build');
  const [week, setWeek] = useState<string>(String(preset?.week ?? currentWeekNumber(data)));
  const [buildId, setBuildId] = useState(preset?.buildId ?? '');
  const [note, setNote] = useState('');
  const valid = Boolean(date) && minutes !== null && minutes >= 1 && minutes <= 16 * 60 && /^\d{2}:\d{2}$/.test(startTime);

  const save = () => {
    if (!valid || minutes === null) return;
    const [hours, mins] = startTime.split(':').map(Number);
    const [year, month, day] = date.split('-').map(Number);
    const start = new Date(year, month - 1, day, hours, mins);
    const end = new Date(start.getTime() + minutes * 60_000);
    update(current =>
      addSession(current, {
        start: start.toISOString(),
        end: end.toISOString(),
        minutes,
        type,
        week: week ? Number(week) : null,
        buildId: buildId || null,
        note,
      }),
    );
    toast(`Logged ${formatMinutes(minutes)}`, 'success');
    onClose();
  };

  return (
    <Dialog
      title="Log time manually"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!valid}>Log time</Button>
        </>
      }
    >
      <div className="form-grid form-grid--2">
        <TextField label="Date" type="date" value={date} onChange={setDate} />
        <div className="field">
          <label htmlFor="log-start">Start time</label>
          <input id="log-start" type="time" value={startTime} onChange={event => setStartTime(event.target.value)} />
        </div>
        <NumberField label="Duration" suffix="min" value={minutes} onChange={setMinutes} min={1} hint="1 to 960 minutes." />
        <SelectField<SessionType> label="Kind of work" value={type} onChange={setType} options={SESSION_OPTIONS} />
        <WeekSelect value={week} onChange={setWeek} />
        <BuildSelect value={buildId} onChange={setBuildId} />
      </div>
      <TextArea label="Note (optional)" value={note} onChange={setNote} rows={2} />
    </Dialog>
  );
}

function WeekSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <SelectField
      label="Curriculum week"
      value={value}
      onChange={onChange}
      options={[{ value: '', label: 'Not tied to a week' }, ...curriculum.weeks.map(week => ({ value: String(week.n), label: `Week ${week.n} · ${week.title}` }))]}
    />
  );
}

function BuildSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data } = useStore();
  return (
    <SelectField
      label="Project / build"
      value={value}
      onChange={onChange}
      options={[{ value: '', label: 'None' }, ...data.builds.map(build => ({ value: build.id, label: build.name }))]}
    />
  );
}
