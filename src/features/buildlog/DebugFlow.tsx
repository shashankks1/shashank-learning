import { useState } from 'react';
import { Button, Dialog, Segmented, SelectField, TextArea, TextField } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { newLogEntry } from '../../lib/schema';
import { addLogEntry } from '../../store/actions';
import { useStore } from '../../store/store';
import { navigate } from '../../router';

/*
 * Debugging mode. It never gives the answer; it walks the method:
 * reproduce → observe → hypothesise → inspect → change one thing → test → document.
 */

const STEPS = [
  {
    key: 'reproduce',
    title: 'Reproduce',
    question: 'Can you make it happen again, on purpose? Write the exact steps.',
    nudges: ['Does it happen every time, or only sometimes?', 'What is the smallest set of steps that triggers it?', 'Does it happen in another browser or a private window?'],
  },
  {
    key: 'observe',
    title: 'Observe',
    question: 'What exactly do you see? Copy the error message, or describe expected vs actual.',
    nudges: ['Is there an error in the Console? Read the first line and the file:line.', 'What did you expect to happen instead?', 'Is anything in the Network panel red?'],
  },
  {
    key: 'hypothesis',
    title: 'Form a hypothesis',
    question: 'What do you think is happening? One sentence you could prove wrong.',
    nudges: ['“The value is undefined because…”', 'What changed since it last worked?', 'If your guess were true, what else would you see?'],
  },
  {
    key: 'inspect',
    title: 'Inspect',
    question: 'Where did you look to confirm or kill the hypothesis, and what did you find?',
    nudges: ['A breakpoint or console.log just before the failure: what are the values?', 'Check the request and response in the Network panel.', 'Read the docs for the exact function involved.'],
  },
  {
    key: 'change',
    title: 'Change one thing',
    question: 'What single change did you make? Only one, so you know what fixed it.',
    nudges: ['If you changed three things, which one mattered?', 'Can you undo it and see the bug return?'],
  },
  {
    key: 'test',
    title: 'Test',
    question: 'Run your reproduction steps again. What happens now?',
    nudges: ['Did you test the original steps, not just the happy path?', 'Did the fix break anything nearby?'],
  },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

export default function DebugFlow({ onClose, preset }: { onClose: () => void; preset?: { buildId?: string | null; week?: number | null } }) {
  const { data, update } = useStore();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<StepKey, string>>({ reproduce: '', observe: '', hypothesis: '', inspect: '', change: '', test: '' });
  const [fixed, setFixed] = useState<'yes' | 'no'>('yes');
  const [title, setTitle] = useState('');
  const [learned, setLearned] = useState('');
  const [next, setNext] = useState('');
  const [buildId, setBuildId] = useState(preset?.buildId ?? '');
  const [loops, setLoops] = useState(0);
  const isDocument = step === STEPS.length;
  const current = STEPS[step];

  const save = () => {
    const entry = newLogEntry({
      buildId: buildId || null,
      week: preset?.week ?? null,
      tried: title.trim() || `Debugging: ${answers.observe.slice(0, 60)}`,
      happened: `Reproduce: ${answers.reproduce}\nAfter the change: ${answers.test}${fixed === 'no' ? ' (not fixed yet)' : ''}`,
      broke: answers.observe,
      why: `Hypothesis: ${answers.hypothesis}\nInspected: ${answers.inspect}`,
      changed: answers.change,
      learned,
      next,
      tags: ['debugging', ...(fixed === 'no' ? ['unresolved'] : [])],
    });
    update(currentData => addLogEntry(currentData, entry));
    toast('Saved to the Build Log', 'success');
    onClose();
    navigate(`#/log/${entry.id}`);
  };

  return (
    <Dialog
      title="Debug mode"
      size="lg"
      onClose={onClose}
      description={<p>No answers here, just the method. Engineers who debug well aren’t smarter; they’re more systematic.</p>}
      footer={
        <>
          <Button variant="ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>{step === 0 ? 'Cancel' : 'Back'}</Button>
          {isDocument ? (
            <Button variant="primary" onClick={save} disabled={!learned.trim()}>Save to Build Log</Button>
          ) : (
            <Button variant="primary" onClick={() => setStep(step + 1)} disabled={answers[current.key].trim().length < 5}>
              {step === STEPS.length - 1 ? 'Document it' : 'Next step'}
            </Button>
          )}
        </>
      }
    >
      <ol className="stepper" aria-label="Debugging steps">
        {[...STEPS.map(item => item.title), 'Document'].map((label, index) => (
          <li key={label} className={index === step ? 'is-current' : index < step ? 'is-done' : ''} aria-current={index === step ? 'step' : undefined}>
            <span className="stepper__n mono">{index + 1}</span>
            <span className="stepper__label">{label}</span>
          </li>
        ))}
      </ol>
      {loops > 0 && <p className="mono-label">Hypothesis loop {loops + 1}</p>}

      {!isDocument ? (
        <div className="debug-step" key={current.key}>
          <h3>{current.title}</h3>
          <TextArea label={current.question} value={answers[current.key]} onChange={value => setAnswers(prev => ({ ...prev, [current.key]: value }))} rows={4} autoFocus />
          <details className="nudges">
            <summary>Stuck? Questions to ask yourself</summary>
            <ul>{current.nudges.map(nudge => <li key={nudge}>{nudge}</li>)}</ul>
          </details>
          {current.key === 'test' && (
            <>
              <Segmented label="Is it fixed?" value={fixed} options={[{ value: 'yes', label: 'Fixed' }, { value: 'no', label: 'Not yet' }]} onChange={setFixed} />
              {fixed === 'no' && (
                <div className="callout">
                  <p>That’s information: your hypothesis was wrong, or incomplete. Go back with a new one.</p>
                  <Button size="sm" onClick={() => { setLoops(loops + 1); setAnswers(prev => ({ ...prev, hypothesis: '', inspect: '', change: '', test: '' })); setStep(2); }}>
                    New hypothesis
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="debug-step">
          <h3>Document</h3>
          <dl className="debug-summary">
            {STEPS.map(item => (
              <div key={item.key}><dt>{item.title}</dt><dd>{answers[item.key]}</dd></div>
            ))}
          </dl>
          <div className="form-grid form-grid--2">
            <TextField label="Title for this entry" value={title} onChange={setTitle} placeholder="e.g. Fetch returned 404 but no error showed" />
            <SelectField label="Build" value={buildId} onChange={setBuildId} options={[{ value: '', label: 'None' }, ...data.builds.map(build => ({ value: build.id, label: build.name }))]} />
          </div>
          <TextArea label="What did you learn? (the reusable lesson)" value={learned} onChange={setLearned} rows={3} autoFocus />
          <TextArea label="What will you try next?" value={next} onChange={setNext} rows={2} />
        </div>
      )}
    </Dialog>
  );
}
