import { useState } from 'react';
import type { TechnicalLevel } from '../../types';
import { Mark } from '../../components/Mark';
import { Button, Dialog, NumberField, SelectField, TextArea, TextField } from '../../components/ui';
import { ConnectForm } from '../sync/SyncPanel';
import { createDemoData } from '../../lib/demo';
import { nowISO, startOfWeek, today } from '../../lib/dates';
import { createId } from '../../lib/id';
import { TECH_LEVEL_LABELS } from '../../lib/labels';
import { useStore } from '../../store/store';

const SCREENS = [
  {
    eyebrow: '01',
    title: 'Become a product-minded AI builder.',
    body: 'Fifty-two weeks of building, from your first semantic page to a product real people use. Design stays at the centre: this adds technology, AI, product and business to it.',
  },
  {
    eyebrow: '02',
    title: 'You don’t need to quit your job.',
    body: 'Six to eight hours a week, planned around a full-time role. The rule is simple: protect the floor, raise the ceiling. No bet is placed without runway.',
  },
  {
    eyebrow: '03',
    title: 'You need a system that compounds.',
    body: 'Every week ends in evidence: something built, a capability proven, a reflection written. Progress here is never a checkbox you clicked. It is what you can show.',
  },
];

const LEVEL_OPTIONS = (Object.keys(TECH_LEVEL_LABELS) as TechnicalLevel[]).map(value => ({ value, label: TECH_LEVEL_LABELS[value] }));

export function Onboarding() {
  const { update, replaceAll } = useStore();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState('');
  const [income, setIncome] = useState<number | null>(null);
  const [hours, setHours] = useState<number | null>(7);
  const [level, setLevel] = useState<TechnicalLevel>('some-code');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const loadDemo = async () => {
    const demo = createDemoData();
    await replaceAll(demo.data, demo.images);
    window.location.hash = '#/dashboard';
  };

  const finish = () => {
    if (hours === null || hours < 1 || hours > 40) {
      setError('Weekly hours should be between 1 and 40. Six to eight is the sustainable target.');
      return;
    }
    const weeklyHours = Math.round(hours);
    update(current => ({
      ...current,
      meta: { ...current.meta, onboarded: true, isDemo: false },
      user: { role: role.trim(), currentIncome: income, weeklyHours, technicalLevel: level, primaryGoal: goal.trim() },
      curriculum: { startDate: startOfWeek(today()), rebases: [] },
      career: {
        ...current.career,
        current: { ...current.career.current, role: role.trim(), income, techLevel: TECH_LEVEL_LABELS[level] },
        incomeHistory: income !== null ? [{ id: createId('i'), date: today(), amount: income, note: 'Starting point' }] : [],
      },
      financial: { ...current.financial, monthlyIncome: income, updatedAt: income !== null ? nowISO() : null },
      settings: {
        ...current.settings,
        weeklyTargetMin: Math.max(2, weeklyHours - 1),
        weeklyTargetMax: weeklyHours + 1,
      },
    }));
    window.location.hash = '#/dashboard';
  };

  const intro = SCREENS[step];
  return (
    <div className="onboarding">
      <div className="onboarding__frame">
        <header className="onboarding__head">
          <span className="brand">
            <Mark className="brand__mark" />
            <span className="brand__text">
              <span className="brand__name">Level 1</span>
              <span className="brand__sub">Product-Minded AI Builder</span>
            </span>
          </span>
          <span className="button-row">
            <button type="button" className="text-btn" onClick={() => setConnecting(true)}>
              I use Level 1 on another device
            </button>
            <button type="button" className="text-btn" onClick={loadDemo}>
              Skip, show me the demo
            </button>
          </span>
        </header>

        <ol className="onboarding__steps" aria-label="Setup progress">
          {[0, 1, 2, 3].map(index => (
            <li key={index} className={index === step ? 'is-current' : index < step ? 'is-done' : ''} aria-current={index === step ? 'step' : undefined}>
              <span className="visually-hidden">Step {index + 1} of 4</span>
            </li>
          ))}
        </ol>

        {intro ? (
          <section className="onboarding__screen" aria-live="polite">
            <p className="onboarding__index">{intro.eyebrow} / 04</p>
            <h1 className="onboarding__title">{intro.title}</h1>
            <p className="onboarding__body">{intro.body}</p>
            <div className="button-row">
              {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>}
              <Button variant="primary" onClick={() => setStep(step + 1)} autoFocus>Continue</Button>
            </div>
          </section>
        ) : (
          <section className="onboarding__screen">
            <p className="onboarding__index">04 / 04</p>
            <h1 className="onboarding__title onboarding__title--sm">Where are you starting from?</h1>
            <p className="onboarding__body">Your answers stay in this browser. They set your weekly target and the starting point for your career and earnings tracking. Everything is editable later.</p>
            <div className="form-grid form-grid--2">
              <TextField label="Current role" value={role} onChange={setRole} placeholder="e.g. Product designer at a SaaS company" />
              <NumberField label="Current monthly income" prefix="₹" value={income} onChange={setIncome} hint="Optional. Private, stays on this device." />
              <NumberField label="Hours you can give each week" suffix="h" value={hours} onChange={setHours} min={1} hint="6–8 is the sustainable target." />
              <SelectField<TechnicalLevel> label="Current technical level" value={level} onChange={setLevel} options={LEVEL_OPTIONS} />
            </div>
            <TextArea label="Primary goal for this year" value={goal} onChange={setGoal} rows={2} placeholder="e.g. Ship real products with AI and grow into a ₹60k+ role without risking my income." />
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="button-row">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button variant="primary" onClick={finish}>Generate my plan</Button>
              <Button variant="secondary" onClick={loadDemo}>Explore the demo first</Button>
            </div>
          </section>
        )}
      </div>
      {connecting && (
        <Dialog
          title="Connect to your synced data"
          onClose={() => setConnecting(false)}
          description={
            <p>
              Easiest: on the device you already use, open Settings → Sync → <strong>Connect another device</strong> and scan the code with this device’s camera. Or enter the data repository and token here.
            </p>
          }
        >
          <ConnectForm compact onConnected={() => setConnecting(false)} />
        </Dialog>
      )}
    </div>
  );
}
