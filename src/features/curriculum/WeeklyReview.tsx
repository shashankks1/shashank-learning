import { useState } from 'react';
import type { WeeklyReview } from '../../types';
import { TOTAL_WEEKS, getWeek } from '../../curriculum';
import { Button, Dialog, NumberField, TextArea } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { minutesForWeek } from '../../lib/activity';
import { nowISO } from '../../lib/dates';
import { SECTION_IDS, SECTION_LABELS, sectionDone, sectionState, weekProgress } from '../../lib/progress';
import { addActivity, addRebase, closeWeek, patchWeek } from '../../store/actions';
import { useStore } from '../../store/store';
import { navigate } from '../../router';

/** End-of-week review. Ends in Continue (close the week) or Rebase (give it another week). */
export function WeeklyReviewDialog({ n, onClose }: { n: number; onClose: () => void }) {
  const { data, update } = useStore();
  const toast = useToast();
  const week = getWeek(n)!;
  const progress = weekProgress(data, n);
  const state = sectionState(data, week);
  const tracked = Math.round((minutesForWeek(data, n) / 60) * 10) / 10;

  const [form, setForm] = useState({
    built: progress.review?.built ?? '',
    understood: progress.review?.understood ?? progress.reflection.understand ?? '',
    confusing: progress.review?.confusing ?? progress.reflection.confused ?? '',
    broke: progress.review?.broke ?? progress.reflection.broke ?? '',
    shipped: progress.review?.shipped ?? progress.shipEvidence,
    evidence: progress.review?.evidence ?? '',
    change: progress.review?.change ?? '',
  });
  const [hours, setHours] = useState<number | null>(progress.review?.hours ?? tracked);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));

  const openSections = SECTION_IDS.filter(section => !sectionDone(state, section));
  // Prove is often the mastery test, which can stay open without holding the schedule hostage.
  const openCore = openSections.filter(section => section !== 'prove');
  const lowHours = hours !== null && hours < data.settings.weeklyTargetMin * 0.5;
  const recommendation: 'continue' | 'rebase' = openCore.length >= 2 || lowHours ? 'rebase' : 'continue';

  const review = (decision: WeeklyReview['decision']): Omit<WeeklyReview, 'at'> => ({ ...form, hours: hours ?? 0, decision });

  const onContinue = () => {
    if (!form.built.trim() || !form.understood.trim()) {
      setError('Write at least what you built and what you understood. That’s the record future you will read.');
      return;
    }
    update(current => closeWeek(current, n, review('continue')));
    toast(`Week ${n} closed.${n < TOTAL_WEEKS ? ` Week ${n + 1} is open.` : ''}`, 'success');
    onClose();
    navigate(n < TOTAL_WEEKS ? `#/curriculum/week/${n + 1}` : '#/report');
  };

  const onRebase = () => {
    update(current => {
      const withReview = patchWeek(current, n, { review: { ...review('rebase'), at: nowISO() } });
      const rebased = addRebase(withReview, n + 1, 1, `Week ${n} extended after review`);
      return addActivity(rebased, 'reflection', `Reviewed Week ${n} and gave it another week`, `week:${n}:rebase-review`);
    });
    toast(`Week ${n} gets another week. Everything after it moves by one week; nothing is lost.`, 'success');
    onClose();
  };

  return (
    <Dialog
      title={`Week ${n} review`}
      size="lg"
      onClose={onClose}
      description={<p>{week.title}. Ten honest minutes. This record is what makes the next six months legible.</p>}
      footer={
        <div className="review-footer">
          <p className="review-footer__recommendation">
            <span className="mono-label">Suggested</span>{' '}
            {recommendation === 'continue'
              ? 'Continue: the core of this week is done.'
              : `Rebase: ${openCore.length >= 2 ? `${openCore.map(section => SECTION_LABELS[section]).join(', ')} still open` : 'very few hours this week'}. No guilt; give it another week.`}
          </p>
          <div className="button-row">
            <Button variant={recommendation === 'rebase' ? 'primary' : 'secondary'} onClick={onRebase}>Rebase: another week</Button>
            <Button variant={recommendation === 'continue' ? 'primary' : 'secondary'} onClick={onContinue}>Continue: close the week</Button>
          </div>
        </div>
      }
    >
      <div className="review-status">
        {SECTION_IDS.map(section => (
          <span key={section} className={`review-status__item ${sectionDone(state, section) ? 'is-done' : ''}`}>
            {SECTION_LABELS[section]} {sectionDone(state, section) ? '✓' : '·'}
          </span>
        ))}
      </div>
      <div className="form-grid form-grid--2">
        <TextArea label="What did I build?" value={form.built} onChange={set('built')} rows={2} />
        <TextArea label="What did I understand?" value={form.understood} onChange={set('understood')} rows={2} />
        <TextArea label="What still feels confusing?" value={form.confusing} onChange={set('confusing')} rows={2} />
        <TextArea label="What broke?" value={form.broke} onChange={set('broke')} rows={2} />
        <TextArea label="What did I ship?" value={form.shipped} onChange={set('shipped')} rows={2} />
        <TextArea label="What evidence did I create?" value={form.evidence} onChange={set('evidence')} rows={2} />
        <NumberField label="How many hours did I actually spend?" suffix="h" value={hours} onChange={setHours} hint={`Timer tracked ${tracked}h for this week.`} step={0.25} />
        <TextArea label="What should change next week?" value={form.change} onChange={set('change')} rows={2} />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Dialog>
  );
}
