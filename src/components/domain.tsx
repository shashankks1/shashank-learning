import { useRef, useState } from 'react';
import type { AiAssist, BuildStatus, Confidence, MasteryState, OpportunityStatus, PortfolioStatus } from '../types';
import { useImage } from '../hooks';
import { compressImage } from '../lib/files';
import {
  BUILD_STATUS_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  PORTFOLIO_STATUS_LABELS,
  WEEK_STATUS_LABELS,
} from '../lib/labels';
import { MASTERY_STATE_LABELS } from '../lib/mastery';
import type { WeekStatus } from '../lib/progress';
import { useStore } from '../store/store';
import { Icon } from './Icon';
import { Button, Checkbox, Pill, Segmented, TextArea, type Tone } from './ui';
import { useToast } from './Toast';

const BUILD_TONES: Record<BuildStatus, Tone> = {
  idea: 'muted',
  planned: 'neutral',
  building: 'accent',
  blocked: 'bad',
  completed: 'ok',
  published: 'ok',
};
export function BuildStatusPill({ status }: { status: BuildStatus }) {
  return <Pill tone={BUILD_TONES[status]}>{BUILD_STATUS_LABELS[status]}</Pill>;
}

const OPPORTUNITY_TONES: Record<OpportunityStatus, Tone> = {
  new: 'neutral',
  investigating: 'accent',
  validating: 'warn',
  promising: 'ok',
  archived: 'muted',
};
export function OpportunityStatusPill({ status }: { status: OpportunityStatus }) {
  return <Pill tone={OPPORTUNITY_TONES[status]}>{OPPORTUNITY_STATUS_LABELS[status]}</Pill>;
}

const MASTERY_TONES: Record<MasteryState, Tone> = {
  'not-started': 'muted',
  learning: 'neutral',
  practicing: 'neutral',
  building: 'accent',
  ready: 'warn',
  passed: 'ok',
  'needs-review': 'warn',
};
export function MasteryStatePill({ state }: { state: MasteryState }) {
  return <Pill tone={MASTERY_TONES[state]}>{MASTERY_STATE_LABELS[state]}</Pill>;
}

const PORTFOLIO_TONES: Record<PortfolioStatus, Tone> = {
  'not-started': 'muted',
  building: 'accent',
  complete: 'neutral',
  published: 'ok',
};
export function PortfolioStatusPill({ status }: { status: PortfolioStatus }) {
  return <Pill tone={PORTFOLIO_TONES[status]}>{PORTFOLIO_STATUS_LABELS[status]}</Pill>;
}

const WEEK_TONES: Record<WeekStatus, Tone> = {
  'not-started': 'muted',
  'in-progress': 'accent',
  complete: 'ok',
  blocked: 'bad',
};
export function WeekStatusPill({ status }: { status: WeekStatus }) {
  return <Pill tone={WEEK_TONES[status]}>{WEEK_STATUS_LABELS[status]}</Pill>;
}

/* ---------------- AI ownership ---------------- */

const CONFIDENCE_OPTIONS: { value: Confidence; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'partly', label: 'Partly' },
  { value: 'no', label: 'No' },
];

export function dependencyRisk(ai: AiAssist): 'none' | 'low' | 'medium' | 'high' {
  if (!ai.used) return 'none';
  const answers = [ai.explain, ai.modify, ai.reproduce];
  if (answers.some(answer => answer === '' )) return 'medium';
  const no = answers.filter(answer => answer === 'no').length;
  const partly = answers.filter(answer => answer === 'partly').length;
  if (no >= 1) return 'high';
  if (partly >= 2) return 'medium';
  return partly === 1 ? 'low' : 'none';
}

const RISK_COPY = {
  none: 'You own this work.',
  low: 'Low dependency. Close the gap when you next touch it.',
  medium: 'Medium dependency. Rebuild the AI-assisted part once without help.',
  high: 'High dependency. You can’t yet explain or change this without AI. Treat it as borrowed, not learned.',
} as const;

/** "AI should increase leverage without decreasing agency." */
export function AiAssistFields({ value, onChange }: { value: AiAssist; onChange: (value: AiAssist) => void }) {
  const risk = dependencyRisk(value);
  return (
    <div className="ai-assist">
      <Checkbox checked={value.used} onChange={used => onChange({ ...value, used })}>
        AI assisted with this work
      </Checkbox>
      {value.used && (
        <div className="ai-assist__body">
          <TextArea label="What did AI help with?" value={value.helpedWith} onChange={helpedWith => onChange({ ...value, helpedWith })} rows={2} />
          <div className="ai-assist__grid">
            <Segmented<Confidence> label="Understanding: can you explain it?" value={value.explain} options={CONFIDENCE_OPTIONS} onChange={explain => onChange({ ...value, explain })} />
            <Segmented<Confidence> label="Ownership: can you modify or debug it?" value={value.modify} options={CONFIDENCE_OPTIONS} onChange={modify => onChange({ ...value, modify })} />
            <Segmented<Confidence> label="Could you reproduce or reason about it without AI?" value={value.reproduce} options={CONFIDENCE_OPTIONS} onChange={reproduce => onChange({ ...value, reproduce })} />
          </div>
          <p className={`ai-assist__risk risk--${risk}`}>
            <span className="mono-label">Dependency risk · {risk}</span> {RISK_COPY[risk]}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Screenshot evidence ---------------- */

export function ImageField({ label, imageId, onChange }: { label: string; imageId: string | null; onChange: (id: string | null) => void }) {
  const { images } = useStore();
  const toast = useToast();
  const src = useImage(imageId);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      const id = await images.add(dataUrl);
      if (imageId) await images.remove(imageId);
      onChange(id);
      toast('Screenshot saved', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the screenshot.', 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    if (imageId) await images.remove(imageId);
    onChange(null);
  };

  return (
    <div className="field image-field">
      <span className="field__label">{label}</span>
      {src ? (
        <figure className="image-field__preview">
          <img src={src} alt={`${label} preview`} />
        </figure>
      ) : (
        <div className="image-field__empty">
          <Icon name="image" size={22} />
          <span>No screenshot yet</span>
        </div>
      )}
      <div className="image-field__actions">
        <input ref={input} type="file" accept="image/*" hidden onChange={event => choose(event.target.files?.[0])} />
        <Button size="sm" icon="upload" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? 'Saving…' : src ? 'Replace' : 'Add screenshot'}
        </Button>
        {src && <Button size="sm" variant="ghost" icon="trash" onClick={remove}>Remove</Button>}
      </div>
      <p className="field__hint">Images are resized and stored in this browser, and included in your backups.</p>
    </div>
  );
}

export function Thumbnail({ imageId, alt }: { imageId: string | null; alt: string }) {
  const src = useImage(imageId);
  if (!src) return <div className="thumb thumb--empty" aria-hidden="true"><Icon name="image" size={20} /></div>;
  return <img className="thumb" src={src} alt={alt} loading="lazy" />;
}
