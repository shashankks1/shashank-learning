import type { Activity, ActivityType, AppData, ImageMap, Session, SessionType, WeekProgress } from '../types';
import { getWeek } from '../curriculum';
import { addDays, parseISODate, startOfWeek, today, toISODate } from './dates';
import { createEmptyData, emptyAiAssist, emptyWeek, newBuild, newLogEntry, newMasteryProgress, newOpportunity } from './schema';
import { reviewDueDate } from './mastery';

/*
 * Realistic sample data for a learner in Week 3, generated relative to today
 * so the demo always looks current: Week 1 and 2 closed, Week 3 in progress,
 * 2 builds, 1 mastery passed, 3 opportunity observations, 1 portfolio proof.
 */

const DEMO_SCREENSHOT_ID = 'img_demo_profile_page';

/** A timestamp on (this week's Monday + offset days) at hh:mm local, never in the future. */
function stamp(mondayOffset: number, hour: number, minute = 0): string {
  const date = parseISODate(addDays(startOfWeek(today()), mondayOffset));
  date.setHours(hour, minute, 0, 0);
  const latest = Date.now() - 5 * 60_000;
  return new Date(Math.min(date.getTime(), latest)).toISOString();
}

function todayOffset(): number {
  return (parseISODate(today()).getDay() + 6) % 7; // Monday = 0
}

function profilePageScreenshot(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
<rect width="1200" height="750" fill="#F6F5F2"/>
<rect x="0" y="0" width="1200" height="72" fill="#FFFFFF"/>
<rect x="64" y="26" width="120" height="20" rx="4" fill="#17181C"/>
<rect x="820" y="30" width="64" height="12" rx="3" fill="#6B6E76"/><rect x="904" y="30" width="64" height="12" rx="3" fill="#6B6E76"/><rect x="988" y="30" width="64" height="12" rx="3" fill="#6B6E76"/>
<rect x="64" y="140" width="560" height="56" rx="6" fill="#17181C"/>
<rect x="64" y="216" width="460" height="18" rx="4" fill="#9A9CA3"/><rect x="64" y="246" width="400" height="18" rx="4" fill="#9A9CA3"/>
<rect x="64" y="300" width="160" height="44" rx="22" fill="#2C57CA"/>
<rect x="760" y="120" width="376" height="260" rx="10" fill="#E3E1DC"/>
<rect x="64" y="440" width="336" height="220" rx="10" fill="#FFFFFF" stroke="#E3E1DC"/><rect x="432" y="440" width="336" height="220" rx="10" fill="#FFFFFF" stroke="#E3E1DC"/><rect x="800" y="440" width="336" height="220" rx="10" fill="#FFFFFF" stroke="#E3E1DC"/>
<rect x="88" y="468" width="200" height="14" rx="3" fill="#17181C"/><rect x="456" y="468" width="200" height="14" rx="3" fill="#17181C"/><rect x="824" y="468" width="200" height="14" rx="3" fill="#17181C"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface DemoEvent {
  day: number; // offset from this week's Monday
  hour: number;
  type: ActivityType;
  label: string;
  ref?: string;
}

export function createDemoData(): { data: AppData; images: ImageMap } {
  const data = createEmptyData();
  const thisMonday = startOfWeek(today());
  const startDate = addDays(thisMonday, -14);
  const nowOffset = todayOffset();

  data.meta.isDemo = true;
  data.meta.onboarded = true;
  data.user = {
    role: 'Product designer at a SaaS startup',
    currentIncome: 30000,
    weeklyHours: 7,
    technicalLevel: 'some-code',
    primaryGoal: 'Build and ship real products with AI, and grow into a ₹60k+ role without risking my current income.',
  };
  data.curriculum = { startDate, rebases: [] };

  /* ---------- Builds ---------- */
  const profilePage = newBuild({
    name: 'Personal profile page',
    date: addDays(startDate, 2),
    technology: ['HTML', 'CSS', 'GitHub Pages'],
    areas: ['frontend'],
    week: 1,
    objective: 'A one-page profile with semantic structure and an accessible contact form.',
    problem: 'Clients and recruiters see my Behance, but nothing shows I can build.',
    status: 'published',
    githubUrl: 'https://github.com/demo-learner/profile-page',
    liveUrl: 'https://demo-learner.github.io/profile-page/',
    screenshotId: DEMO_SCREENSHOT_ID,
    learned: 'Landmarks matter more than I thought: a screen reader jumps between them. Labels are not optional.',
    broke: 'My form inputs had placeholders instead of labels, so VoiceOver read nothing useful.',
    improve: 'Add real case-study pages and lazy-load the images.',
    portfolioCandidate: true,
    ai: { used: true, helpedWith: 'Explained when to use section vs article.', explain: 'yes', modify: 'yes', reproduce: 'yes' },
    createdAt: stamp(-12, 19),
    updatedAt: stamp(0, 21),
    completedAt: stamp(-9, 18),
  });
  const landingPage = newBuild({
    name: 'Studio landing page',
    date: addDays(startDate, 8),
    technology: ['HTML', 'CSS', 'Git'],
    areas: ['frontend', 'programming'],
    week: 2,
    objective: 'A responsive landing page for a brand-identity service. Moving it to GitHub with a proper README this week.',
    problem: 'Small businesses can’t tell what a brand-identity package includes or costs.',
    status: 'building',
    githubUrl: 'https://github.com/demo-learner/studio-landing',
    learned: 'Grid auto-fit removed three media queries. Custom properties made the Figma tokens map one-to-one.',
    broke: 'Horizontal scroll at 375px, caused by a 1200px-wide hero image without max-width.',
    improve: 'Write the README, add a pricing section, merge the copy-edits branch through a pull request.',
    portfolioCandidate: true,
    ai: { used: true, helpedWith: 'Asked what could cause horizontal scroll, then found it myself in DevTools.', explain: 'yes', modify: 'yes', reproduce: 'partly' },
    createdAt: stamp(-7, 20),
    updatedAt: stamp(Math.min(nowOffset, 1), 20),
  });
  data.builds = [profilePage, landingPage];

  /* ---------- Activity timeline ---------- */
  const events: DemoEvent[] = [];
  const learn = (week: number, index: number, day: number, hour: number) => {
    const text = getWeek(week)?.learn[index] ?? '';
    events.push({ day, hour, type: 'lesson', label: `Studied: ${text}`, ref: `week:${week}:learn:${index}` });
  };
  const practice = (week: number, index: number, day: number, hour: number) => {
    const text = getWeek(week)?.practice[index] ?? '';
    events.push({ day, hour, type: 'exercise', label: `Practised: ${text}`, ref: `week:${week}:practice:${index}` });
  };

  // Week 1 (offsets -14..-8)
  learn(1, 0, -14, 20); learn(1, 1, -14, 21);
  learn(1, 2, -12, 20); practice(1, 0, -12, 21);
  learn(1, 3, -11, 20); learn(1, 4, -11, 21);
  learn(1, 5, -10, 20); practice(1, 1, -10, 21); practice(1, 2, -10, 21);
  practice(1, 3, -9, 11);
  events.push({ day: -9, hour: 17, type: 'build', label: 'Week 1 build done: Personal profile page', ref: 'week:1:build' });
  events.push({ day: -9, hour: 18, type: 'log', label: 'Build log: placeholder-only inputs had no accessible names' });
  events.push({ day: -8, hour: 18, type: 'mastery', label: 'Passed mastery: Semantic webpage from a blank file' });
  events.push({ day: -8, hour: 19, type: 'ship', label: 'Shipped: profile page opened on another phone', ref: 'week:1:ship' });
  events.push({ day: -8, hour: 20, type: 'reflection', label: 'Closed Week 1 with a weekly review' });

  // Week 2 (offsets -7..-1). Wednesday (-5) deliberately quiet: life happens.
  learn(2, 0, -7, 20); learn(2, 1, -7, 21); learn(2, 2, -7, 21);
  learn(2, 3, -6, 20);
  events.push({ day: -6, hour: 22, type: 'opportunity', label: 'Added opportunity: Kirana owners re-type supplier bills' });
  learn(2, 4, -4, 20); learn(2, 5, -4, 21); practice(2, 0, -4, 21);
  learn(2, 6, -3, 20); learn(2, 7, -3, 20); practice(2, 1, -3, 21);
  events.push({ day: -3, hour: 22, type: 'opportunity', label: 'Added opportunity: Freelance designers chase payments on WhatsApp' });
  practice(2, 2, -2, 11); practice(2, 3, -2, 12);
  events.push({ day: -2, hour: 15, type: 'log', label: 'Build log: horizontal scroll at 375px' });
  events.push({ day: -2, hour: 18, type: 'build', label: 'Week 2 build done: Studio landing page', ref: 'week:2:build' });
  events.push({ day: -1, hour: 11, type: 'log', label: 'Build log: Figma type scale vs rem' });
  events.push({ day: -1, hour: 19, type: 'ship', label: 'Shipped: landing page screenshots at 375 and 1440px', ref: 'week:2:ship' });
  events.push({ day: -1, hour: 20, type: 'reflection', label: 'Closed Week 2 with a weekly review' });

  // Week 3 (this week): only days up to today happen.
  learn(3, 0, 0, 20); learn(3, 1, 0, 20);
  events.push({ day: 0, hour: 21, type: 'opportunity', label: 'Added opportunity: Coaching institutes juggle timetables in Excel' });
  events.push({ day: 0, hour: 22, type: 'log', label: 'Build log: git push rejected after creating the repo with a README' });
  events.push({ day: 0, hour: 22, type: 'build', label: 'Published project: Personal profile page on GitHub Pages' });
  if (nowOffset >= 1) {
    learn(3, 2, 1, 20); practice(3, 0, 1, 21);
    events.push({ day: 1, hour: 22, type: 'career', label: 'Career: quoted ₹12,000 for a café landing page' });
  }
  if (nowOffset >= 2) { learn(3, 3, 2, 20); practice(3, 1, 2, 21); }
  if (nowOffset >= 3) events.push({ day: 3, hour: 21, type: 'reflection', label: 'Wrote Week 3 reflection: detached HEAD confusion' });

  data.activities = events.map((event, index): Activity => ({
    id: `a_demo_${index}`,
    type: event.type,
    at: stamp(event.day, event.hour, (index * 7) % 50),
    label: event.label,
    ref: event.ref,
  }));

  /* ---------- Sessions ---------- */
  const sessionPlan: [number, number, SessionType, number, number | null, string][] = [
    // [day, hour, type, minutes, week, note]
    [-14, 20, 'learn', 45, 1, 'Semantic HTML, MDN'],
    [-12, 20, 'practice', 50, 1, 'Recipe markup + DevTools landmarks'],
    [-10, 20, 'learn', 40, 1, 'Forms and labels'],
    [-9, 11, 'build', 150, 1, 'Profile page build'],
    [-8, 18, 'review', 65, 1, 'Mastery test + weekly review'],
    [-7, 20, 'learn', 50, 2, 'Cascade and box model'],
    [-6, 20, 'learn', 45, 2, 'Typography in rem'],
    [-4, 20, 'practice', 60, 2, 'Grid Garden + card reflow'],
    [-3, 20, 'learn', 40, 2, 'Custom properties as tokens'],
    [-2, 11, 'build', 190, 2, 'Landing page build'],
    [-1, 18, 'review', 70, 2, 'Screenshots, README draft, weekly review'],
    [0, 20, 'learn', 55, 3, 'Repositories, commits, .gitignore'],
    [1, 20, 'practice', 45, 3, 'Learn Git Branching intro'],
    [2, 20, 'learn', 40, 3, 'Branches and pull requests'],
    [3, 20, 'build', 60, 3, 'Landing page README'],
  ];
  data.sessions = sessionPlan
    .filter(([day]) => day <= nowOffset)
    .map(([day, hour, type, minutes, week, note], index): Session => {
      const startMs = Math.min(new Date(stamp(day, hour)).getTime(), Date.now() - (minutes + 10) * 60_000);
      const start = new Date(startMs).toISOString();
      const end = new Date(startMs + minutes * 60_000).toISOString();
      const buildId = type === 'build' ? (week === 1 ? profilePage.id : landingPage.id) : null;
      return { id: `s_demo_${index}`, start, end, minutes, type, week, buildId, note };
    });

  /* ---------- Weeks ---------- */
  const checkedFrom = (week: number) =>
    data.activities.filter(activity => activity.ref?.startsWith(`week:${week}:`) && /:(learn|practice):\d+$/.test(activity.ref)).map(activity => activity.ref!.replace(`week:${week}:`, ''));

  const week1: WeekProgress = {
    ...emptyWeek(),
    checked: checkedFrom(1),
    buildId: profilePage.id,
    buildDone: true,
    reflection: {
      confused: 'When to use section vs article vs a plain div.',
      broke: 'Placeholder-only inputs: the screen reader had no names to announce.',
      understand: 'Structure is for machines and people at the same time. Headings are an outline, landmarks are navigation.',
      extra0: 'I used divs for the cards out of habit and switched them to article.',
    },
    shipEvidence: 'Opened on Anjali’s phone; W3C validator shows no errors.',
    shipDone: true,
    tryFirst: { level: 2, attempt: 'Wrapped the links in a nav but forgot the list. The hint made it click.', triedAt: stamp(-12, 21) },
    notes: '',
    startedAt: stamp(-14, 20),
    completedAt: stamp(-8, 20, 30),
    review: {
      built: 'A semantic profile page with a working, labelled contact form.',
      understood: 'How landmarks and headings create structure for screen readers, and why labels matter.',
      confusing: 'section vs article vs div.',
      broke: 'Placeholder-only inputs had no accessible names.',
      shipped: 'Page opened on another phone; validated with W3C.',
      evidence: 'Screenshot, validator pass, mastery m01 passed.',
      hours: 5.8,
      change: 'Do the practice exercises before starting the build, not after.',
      decision: 'continue',
      at: stamp(-8, 20, 30),
    },
  };
  const week2: WeekProgress = {
    ...emptyWeek(),
    checked: checkedFrom(2),
    buildId: landingPage.id,
    buildDone: true,
    reflection: {
      confused: 'Why my Figma sizes looked smaller in the browser.',
      broke: 'Horizontal scroll at 375px from a fixed-width image.',
      understand: 'Grid can decide the column count itself. The cascade is a feature, not an enemy.',
      extra0: 'Figma was right about hierarchy; the browser was right about real text wrapping.',
    },
    shipEvidence: 'Screenshots at 375px and 1440px saved in the project /screens folder.',
    shipDone: true,
    tryFirst: { level: 1, attempt: 'Got auto-fit + minmax working without the hint.', triedAt: stamp(-4, 21) },
    startedAt: stamp(-7, 20),
    completedAt: stamp(-1, 20, 40),
    review: {
      built: 'A responsive studio landing page from my own Figma design.',
      understood: 'Flexbox vs Grid; rem-based type scales; custom properties as design tokens.',
      confusing: 'Specificity battles when I mixed class and element selectors.',
      broke: 'Overflow at 375px (fixed-width image).',
      shipped: 'Screenshots at two widths; the page isn’t live yet.',
      evidence: 'Screens folder plus a build log entry. Mastery m02 still open.',
      hours: 7.6,
      change: 'Start the mastery test on Saturday, not Sunday night.',
      decision: 'continue',
      at: stamp(-1, 20, 40),
    },
  };
  const week3: WeekProgress = {
    ...emptyWeek(),
    checked: checkedFrom(3),
    buildId: landingPage.id,
    reflection: nowOffset >= 3
      ? { confused: 'Why git said “detached HEAD” after I checked out an old commit, and how to get back.' }
      : {},
    startedAt: stamp(0, 20),
  };
  data.weeks = { 1: week1, 2: week2, 3: week3 };

  /* ---------- Mastery ---------- */
  const passedAt = stamp(-8, 18);
  data.mastery = [
    {
      ...newMasteryProgress('m01'),
      state: 'passed',
      criteria: [0, 1, 2, 3, 4, 5],
      evidence: {
        github: '',
        live: '',
        screenshotId: DEMO_SCREENSHOT_ID,
        explanation:
          'I built a page about my brand-identity process from an empty file. header holds the name and nav; main has three sections (process, work, contact), each with an h2 under one h1. Work items are articles because each could stand alone. The form uses label for= on every input, and I tabbed through it end to end.',
        document: '',
      },
      reflection:
        'I can now explain why each landmark exists: navigation for screen-reader users, structure for search engines, and a mental model for me. I still look up which input types exist, but the structure comes from my head now.',
      withinConstraints: true,
      ai: emptyAiAssist(),
      attempts: [{ id: 'att_demo_1', at: passedAt, result: 'passed', note: 'Built from a blank file in 2.5 hours. Validator clean.' }],
      passedAt,
      reviewDueAt: reviewDueDate(toISODate(new Date(passedAt))),
    },
    {
      ...newMasteryProgress('m02'),
      state: 'ready',
      criteria: [0, 1, 2, 4],
      evidence: { github: '', live: '', screenshotId: null, explanation: 'Recreated the hero and features section of a reference SaaS page…', document: '' },
    },
    { ...newMasteryProgress('m03'), state: 'learning' },
  ];

  /* ---------- Opportunity Lab ---------- */
  const kirana = newOpportunity({
    title: 'Kirana owners re-type supplier bills into billing apps',
    status: 'investigating',
    problem: 'Small grocery shops receive paper or WhatsApp-photo invoices from 6–10 suppliers and type every line into their billing/stock app by hand.',
    who: 'Owners, or their one assistant, at kirana stores turning over ₹2–5 lakh a month in tier-2 cities.',
    frequency: 'Daily; 15–40 invoices a week.',
    workaround: 'Typing at night after closing. Some skip stock entry entirely and guess reorders.',
    cost: '1–1.5 hours a day; stock-outs on fast movers; pricing errors when the MRP changes.',
    existingSolutions: 'Billing apps (manual entry); a few OCR apps, mostly English-only, that struggle with handwriting.',
    insufficient: 'Handwritten and regional-language bills. Owners don’t trust OCR that silently gets numbers wrong.',
    aiLeverage: 'Vision models can read messy invoices; a confirm-every-line UX could keep the owner in control.',
    techLeverage: 'Photo, then structured lines, then one-tap import: could cut entry time by most of an hour a day.',
    distribution: 'Distributor networks; billing-app partnerships; local accountants who set up shops.',
    evidence: [
      { id: 'e_demo_1', date: addDays(thisMonday, -6), kind: 'interview', summary: '“Raat ko ek ghanta sirf bill chadhane mein jaata hai.” He showed me a stack of 22 bills from this week.', source: 'Neighbourhood kirana owner, in person' },
      { id: 'e_demo_2', date: addDays(thisMonday, -3), kind: 'observation', summary: 'Watched an assistant enter 9 invoices in 35 minutes; 2 errors corrected later.', source: 'Store visit' },
    ],
    unknowns: 'Would they pay, or expect it free inside the billing app? Do bigger suppliers already send digital invoices?',
    notes: 'Don’t pitch yet. Next: two more stores, ask about the last time stock ran out.',
    createdAt: stamp(-6, 22),
    updatedAt: stamp(-3, 21),
  });
  kirana.scores.severity = { score: 4, note: 'An hour a day, every day.' };
  kirana.scores.frequency = { score: 5, note: 'Daily.' };
  kirana.scores.market = { score: 4, note: 'Millions of kiranas; maybe 10–20% digitised.' };
  kirana.scores.willingnessToPay = { score: 2, note: 'Unknown. Biggest risk.' };
  kirana.scores.competition = { score: 3, note: 'OCR exists but is weak on handwriting.' };
  kirana.scores.feasibility = { score: 3, note: 'Needs vision API plus careful review UX: Month 7–8 skills.' };
  kirana.scores.distribution = { score: 2, note: 'Hard to reach shops cheaply.' };
  kirana.scores.defensibility = { score: 2, note: '' };
  kirana.scores.timing = { score: 4, note: 'Vision models got good and cheap in the last year.' };

  const payments = newOpportunity({
    title: 'Freelance designers chase payments on WhatsApp',
    status: 'new',
    problem: 'Freelance designers send invoices as PDFs on WhatsApp and chase payment with awkward reminders for weeks.',
    who: 'Solo designers and small studios billing ₹10k–₹2L per project.',
    frequency: 'Every project; reminders weekly.',
    workaround: 'Manual reminders, screenshots of bank transfers, a spreadsheet of who owes what.',
    cost: 'Payments 30–60 days late; time and awkwardness; GST filing pain.',
    existingSolutions: 'Payment links, invoicing tools (Zoho Invoice, Refrens).',
    insufficient: 'Feels heavy for a freelancer sending 3 invoices a month; reminders feel impersonal.',
    aiLeverage: 'Low. This is workflow, not AI. Don’t force it.',
    techLeverage: 'Payment links, polite automatic reminders, and a “who owes me” view.',
    distribution: 'Design communities, Instagram, Behance India groups.',
    evidence: [{ id: 'e_demo_3', date: addDays(thisMonday, -3), kind: 'data', summary: 'Across my own last 5 projects, the average payment delay was 24 days.', source: 'My invoices' }],
    unknowns: 'Is it painful enough to pay for, given the free options?',
    createdAt: stamp(-3, 22),
    updatedAt: stamp(-3, 22),
  });
  payments.scores.severity = { score: 3, note: '' };
  payments.scores.frequency = { score: 4, note: '' };
  payments.scores.market = { score: 3, note: '' };
  payments.scores.willingnessToPay = { score: 2, note: 'Free tools exist.' };
  payments.scores.competition = { score: 2, note: 'Crowded.' };
  payments.scores.feasibility = { score: 5, note: 'Could build a slice by Month 5.' };
  payments.scores.distribution = { score: 4, note: 'I am the customer; I know the communities.' };
  payments.scores.defensibility = { score: 1, note: '' };
  payments.scores.timing = { score: 2, note: '' };

  const coaching = newOpportunity({
    title: 'Coaching institutes juggle timetables in Excel and WhatsApp',
    status: 'new',
    problem: 'Small coaching centres plan batches, rooms and teacher slots in Excel, then announce changes in WhatsApp groups; students miss changes.',
    who: 'Owners and admins of coaching institutes with 100–600 students.',
    frequency: 'Weekly timetable; changes several times a week.',
    workaround: 'Excel plus WhatsApp broadcast; phone calls for last-minute changes.',
    cost: 'Missed classes, double-booked rooms, admin time.',
    existingSolutions: 'School ERPs, Google Calendar, coaching apps focused on content and fees.',
    insufficient: 'ERPs are heavy and expensive for small centres.',
    aiLeverage: 'Maybe: turning a message like “move Tuesday physics to 5pm” into a timetable change.',
    techLeverage: 'A shared timetable with change notifications.',
    distribution: 'Coaching associations, local ads, word of mouth.',
    unknowns: 'Haven’t talked to anyone yet. Is this the admin’s pain or the owner’s?',
    createdAt: stamp(0, 21),
    updatedAt: stamp(0, 21),
  });
  coaching.scores.severity = { score: 3, note: 'Guess, no evidence yet.' };
  coaching.scores.frequency = { score: 4, note: '' };
  data.opportunities = [kirana, payments, coaching];

  /* ---------- Portfolio ---------- */
  data.portfolio[0] = {
    ...data.portfolio[0],
    buildId: profilePage.id,
    project: 'Personal profile page',
    capability: 'Semantic HTML, accessible forms, responsive CSS',
    problem: 'Clients only ever saw static visuals; nothing showed I could build.',
    role: 'Designer and developer (solo)',
    technology: 'HTML, CSS, GitHub Pages',
    designDecisions: 'Single column on mobile; type scale from my Figma tokens; the contact form is first-class, not hidden in the footer.',
    technicalDecisions: 'No framework: semantic HTML and one CSS file. Validated with W3C; Lighthouse accessibility 100.',
    result: 'Live and shared with 3 people. The first time I sent a link instead of a PDF.',
    github: profilePage.githubUrl,
    live: profilePage.liveUrl,
    status: 'published',
    updatedAt: stamp(0, 22),
  };

  /* ---------- Build log ---------- */
  data.buildLog = [
    newLogEntry({
      date: addDays(startDate, 5),
      buildId: profilePage.id,
      week: 1,
      tried: 'Contact form with placeholder-only inputs',
      happened: 'Looked clean in the browser.',
      broke: 'VoiceOver announced “edit text, blank” for every field.',
      why: 'Placeholders aren’t labels; the inputs had no accessible name.',
      learned: 'Every input needs a label. A placeholder is a hint, not a name.',
      changed: 'Added visible labels and kept short placeholders as examples.',
      next: 'Test the whole page with the keyboard only.',
      tags: ['html', 'accessibility'],
      createdAt: stamp(-9, 18),
      updatedAt: stamp(-9, 18),
    }),
    newLogEntry({
      date: addDays(startDate, 12),
      buildId: landingPage.id,
      week: 2,
      tried: 'Hero section with a full-width image',
      happened: 'Fine on desktop; scrolled sideways on my phone.',
      broke: 'Horizontal scroll at 375px.',
      why: 'The image had a fixed 1200px width and no max-width.',
      learned: 'To find the widest element, temporarily add * { outline: 1px solid red } and look.',
      changed: 'img { max-width: 100%; height: auto; } in the base CSS.',
      next: 'Make that rule part of every project’s reset.',
      tags: ['css', 'responsive', 'debugging'],
      ai: { used: true, helpedWith: 'Listed common causes of horizontal scroll.', explain: 'yes', modify: 'yes', reproduce: 'yes' },
      createdAt: stamp(-2, 15),
      updatedAt: stamp(-2, 15),
    }),
    newLogEntry({
      date: addDays(startDate, 13),
      buildId: landingPage.id,
      week: 2,
      tried: 'Translating my Figma type scale to CSS',
      happened: 'Sizes looked smaller than in Figma at 1440px.',
      broke: 'Headings felt weak.',
      why: 'I’d used px values from a 1920px frame; the browser’s base size and the frame didn’t match.',
      learned: 'Design the scale in rem from the start and check at 100% zoom.',
      changed: 'Defined --step-0 to --step-5 with clamp().',
      next: 'Reuse the same tokens in the next project.',
      tags: ['css', 'design-tokens'],
      createdAt: stamp(-1, 11),
      updatedAt: stamp(-1, 11),
    }),
    newLogEntry({
      date: thisMonday,
      buildId: landingPage.id,
      week: 3,
      tried: 'git push of the landing page to a new GitHub repository',
      happened: 'Rejected: “Updates were rejected because the remote contains work that you do not have locally.”',
      broke: 'The push failed after creating the GitHub repo with a README.',
      why: 'GitHub made an initial commit (the README) that my local repo didn’t have.',
      learned: 'Pull first (git pull --rebase origin main), or create the GitHub repo empty.',
      changed: 'Pulled with rebase, resolved the README conflict, pushed.',
      next: 'Try the branch + pull request flow for the copy edits.',
      tags: ['git'],
      createdAt: stamp(0, 22),
      updatedAt: stamp(0, 22),
    }),
  ];

  /* ---------- Career & money ---------- */
  data.career = {
    current: { role: 'Product designer', income: 30000, techLevel: 'HTML/CSS, some JavaScript' },
    target: { role: 'Design engineer / AI product builder', income: 60000, techLevel: 'Full-stack web plus AI features' },
    stage: 1,
    experiments: [
      {
        id: 'x_demo_1',
        type: 'networking',
        title: 'Coffee chat with a design engineer at a fintech',
        org: 'Fintech startup, Bengaluru',
        date: addDays(thisMonday, -9),
        status: 'closed',
        outcome: 'Advice: show working prototypes, not Dribbble shots. Learn React and one backend.',
        notes: '',
        amount: null,
      },
      {
        id: 'x_demo_2',
        type: 'freelance',
        title: 'Landing page for a neighbourhood café',
        org: 'Local café',
        date: addDays(thisMonday, Math.min(nowOffset, 1)),
        status: 'waiting',
        outcome: '',
        notes: 'Quoted ₹12,000 for a one-page site. Waiting to hear back.',
        amount: 12000,
      },
    ],
    incomeHistory: [{ id: 'i_demo_1', date: startDate, amount: 30000, note: 'Starting point' }],
  };
  data.financial = {
    monthlyIncome: 30000,
    essentialExpenses: 17000,
    liquidSavings: 52000,
    monthlyDebt: 3500,
    targetRunwayMonths: 6,
    updatedAt: stamp(-14, 21),
  };

  return { data, images: { [DEMO_SCREENSHOT_ID]: profilePageScreenshot() } };
}
