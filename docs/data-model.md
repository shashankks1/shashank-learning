# Data model (schema v2)

The full TypeScript definitions are in [`src/types.ts`](../src/types.ts). This is the map.

```text
AppData {
  schemaVersion: 2
  meta          created/updated, lastExportAt, isDemo, onboarded
  user          role, currentIncome, weeklyHours, technicalLevel, primaryGoal
  curriculum    startDate (Monday of week 1), rebases[]  ← the plan, not the content
  weeks         { [n]: WeekProgress }  checked items, build link, prove/ship, reflection, Try First level, review, completedAt
  activities[]  meaningful actions with timestamps → streak, recent activity, heatmap
  sessions[]    time tracking: start, end, minutes, type, week, build
  activeSession running timer (survives refresh)
  builds[]      projects + evidence + AI-ownership check
  mastery[]     per test: state, criteria met, evidence, reflection, attempts, passedAt, reviewDueAt
  opportunities[] problem, people, economics, leverage, distribution, evidence log, 9 scored dimensions
  portfolio[5]  exactly five proof slots
  buildLog[]    tried, happened, broke, why, learned, changed, next, tags
  career        current, target, stage 1–9, experiments[], incomeHistory[]
  financial     income, essentials, debt, liquid savings, target runway
  resources[]   your own additions (curriculum resources live in /data)
  milestones    claimed milestones with evidence (detected ones are computed)
  yearReview    narrative fields for the Capability Report
  settings      theme, weekly target, streak activity types, backup reminder, privacy toggles
}
```

## Backup file

```json
{
  "format": "level1-builder-backup",
  "app": "Level 1 — Product-Minded AI Builder",
  "schemaVersion": 2,
  "exportedAt": "2026-10-07T16:30:00.000Z",
  "data": { "…": "AppData" },
  "images": { "img_…": "data:image/webp;base64,…" }
}
```

## Versioning and migrations

- `SCHEMA_VERSION` lives in `src/types.ts`.
- To change the shape: bump the version, then add a step to `migrations` in `src/lib/backup.ts` that upgrades **from** the previous version. Steps run in order on import.
- `normalizeAppData` then fills any missing fields from the factories in `src/lib/schema.ts` and drops malformed records, with a warning for each. Data from a *newer* schema is refused rather than guessed at.
- v1 backups (`"format": "level1-curriculum-backup"`) go through `fromLegacy` in `backup.ts`.

## Curriculum content

`data/curriculum/month-NN.json`:

```text
{ month: { n, title, theme, build, mastery, checkpoint },
  weeks: [{ n, month, title, objective, areas[], hours[lo,hi], learn[], practice[],
            build { title, brief }, prove, masteryId|null, reflect[], ship,
            tryFirst { task, hint, explanation, solution }, resources[{ title, url, type }] }],
  mastery: [{ id, week, area, title, challenge, constraints[], criteria[], evidence[] }] }
```

Progress refers to content by week number, item index (`"learn:3"`) and mastery id. Keep those stable once you've started using the app.
