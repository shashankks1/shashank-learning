import { useEffect, useRef, useState } from 'react';
import { getWeek } from '../../curriculum';
import { Icon } from '../../components/Icon';
import { Button, Segmented, TextArea } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { currentWeekNumber } from '../../lib/progress';
import { newLogEntry } from '../../lib/schema';
import { addLogEntry } from '../../store/actions';
import { useStore } from '../../store/store';
import { useUi, type CoachMode } from '../shell/ui-context';

/*
 * The coach works offline. It asks before it tells: a sequence of questions
 * per mode, then (optionally) a ready-made prompt for whatever AI assistant
 * you use, carrying the same "don't just give me the answer" rules.
 */

interface ModeDefinition {
  label: string;
  purpose: string;
  questions: string[];
  rules: string;
}

const MODES: Record<CoachMode, ModeDefinition> = {
  teacher: {
    label: 'Teacher',
    purpose: 'Explain a concept, but only after you’ve said what you think it means.',
    questions: [
      'Which concept do you want to understand?',
      'In one or two sentences, what do you think it means right now? Guessing is fine.',
      'Where have you seen it in your own work: a site, an app, a Figma file?',
      'Which part exactly doesn’t make sense yet?',
      'Read the official docs section on it (Resources has links). Now explain it again in your own words.',
    ],
    rules:
      'Act as my teacher. I am a product designer learning to build software. Before explaining, ask what I think the concept means and correct my mental model rather than replacing it. Use an analogy from design where it helps. Keep explanations short, then ask me to explain it back. Teach concepts that survive tool changes.',
  },
  coach: {
    label: 'Coach',
    purpose: 'Ask questions and guide. You do the thinking; it keeps you moving.',
    questions: [
      'What are you trying to do right now?',
      'What have you tried so far?',
      'What do you think is happening?',
      'What is the smallest next step you could test in 15 minutes?',
      'How will you know it worked?',
    ],
    rules:
      'Act as a coach, not an answer machine. Ask me one question at a time. Prefer “What do you think is happening?” over giving the answer. Do not write code for me unless I explicitly ask after I have attempted it myself. Help me break the problem into a next step I can test.',
  },
  debugger: {
    label: 'Debugger',
    purpose: 'Diagnose a problem systematically. For the full method, use Debug mode.',
    questions: [
      'What did you expect to happen?',
      'What happened instead? Paste the exact error or describe the output.',
      'What changed since it last worked?',
      'What do you think is happening? One testable sentence.',
      'What will you inspect to prove or disprove that?',
    ],
    rules:
      'Help me debug systematically: reproduce, observe, form a hypothesis, inspect, change one thing, test, document. Do not give me the fix directly. Ask what I observe and guide me to the next observation or experiment. If I am stuck after two hypotheses, give a hint, not the solution.',
  },
  challenger: {
    label: 'Challenger',
    purpose: 'Question assumptions and raise the standard.',
    questions: [
      'What are you claiming? (“This is done”, “this problem is worth solving”, “I understand X”)',
      'What is your evidence?',
      'What would a sceptical reviewer say is missing?',
      'What would make this twice as good?',
      'What are you avoiding?',
    ],
    rules:
      'Act as a demanding but constructive reviewer. Challenge my assumptions, point out missing evidence and weak reasoning, and ask what a sceptical senior engineer, designer or investor would ask. Raise the bar; do not flatter. End with the single most important thing to fix.',
  },
};

export default function CoachPanel({ onClose, initialMode, initialContext }: { onClose: () => void; initialMode?: CoachMode; initialContext?: string }) {
  const { data, update } = useStore();
  const ui = useUi();
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const week = getWeek(currentWeekNumber(data))!;
  const [mode, setMode] = useState<CoachMode>(initialMode ?? 'coach');
  const [context, setContext] = useState(initialContext ?? `Week ${week.n}: ${week.title}. Build: ${week.build.title}.`);
  const [answers, setAnswers] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const definition = MODES[mode];
  const step = answers.length;
  const finished = step >= definition.questions.length;

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  const switchMode = (next: CoachMode) => {
    setMode(next);
    setAnswers([]);
    setDraft('');
  };

  const answer = () => {
    if (!draft.trim()) return;
    setAnswers(current => [...current, draft.trim()]);
    setDraft('');
  };

  const transcript = definition.questions
    .slice(0, answers.length)
    .map((question, index) => `Q: ${question}\nA: ${answers[index]}`)
    .join('\n\n');

  const prompt = `${definition.rules}\n\nContext: ${context}\n\nWhat I have worked out so far:\n${transcript || '(nothing yet)'}\n\nRespond in ${definition.label} mode.`;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast('Prompt copied. Paste it into your AI assistant.', 'success');
    } catch {
      toast('Could not copy automatically. Select the prompt text and copy it.', 'error');
    }
  };

  const saveToLog = () => {
    const entry = newLogEntry({
      week: week.n,
      tried: `${definition.label} session: ${answers[0]?.slice(0, 70) ?? context.slice(0, 70)}`,
      happened: transcript,
      learned: answers[answers.length - 1] ?? '',
      tags: ['coach', mode],
    });
    update(current => addLogEntry(current, entry));
    toast('Saved to the Build Log', 'success');
  };

  return (
    <dialog
      ref={dialog}
      className="coach"
      aria-labelledby="coach-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onMouseDown={event => { if (event.target === dialog.current) onClose(); }}
    >
      <div className="coach__inner">
        <header className="coach__head">
          <div>
            <p className="mono-label">AI coach · works offline</p>
            <h2 id="coach-title">What do you think is happening?</h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close coach" onClick={onClose}><Icon name="close" /></button>
        </header>

        <Segmented<CoachMode>
          label="Mode"
          hideLabel
          value={mode}
          onChange={switchMode}
          options={(Object.keys(MODES) as CoachMode[]).map(value => ({ value, label: MODES[value].label }))}
        />
        <p className="coach__purpose">{definition.purpose}</p>
        {mode === 'debugger' && (
          <Button size="sm" icon="bug" onClick={() => { onClose(); ui.openDebug({ week: week.n }); }}>Open the full 7-step Debug mode</Button>
        )}

        <TextArea label="Context" value={context} onChange={setContext} rows={2} />

        <ol className="coach__thread">
          {answers.map((value, index) => (
            <li key={index}>
              <p className="coach__q">{definition.questions[index]}</p>
              <p className="coach__a">{value}</p>
            </li>
          ))}
        </ol>

        {!finished ? (
          <div className="coach__ask">
            <TextArea label={definition.questions[step]} value={draft} onChange={setDraft} rows={3} autoFocus />
            <div className="button-row">
              <Button variant="primary" onClick={answer} disabled={!draft.trim()}>Answer</Button>
              <span className="mono muted">{step + 1} / {definition.questions.length}</span>
            </div>
          </div>
        ) : (
          <div className="coach__done">
            <p>You’ve worked it through. Often the answer is already in what you wrote. Read it back once.</p>
            <div className="button-row">
              <Button onClick={saveToLog} icon="log">Save to Build Log</Button>
              <Button variant="ghost" onClick={() => setAnswers([])}>Start again</Button>
            </div>
          </div>
        )}

        <details className="coach__prompt">
          <summary>Continue with your own AI assistant</summary>
          <p className="field__hint">A prompt that keeps the same rules: it asks before it answers. Nothing is sent anywhere by this app.</p>
          <pre className="code code--wrap">{prompt}</pre>
          <Button size="sm" onClick={copyPrompt}>Copy prompt</Button>
        </details>
      </div>
    </dialog>
  );
}
