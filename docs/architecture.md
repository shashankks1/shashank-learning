# Architecture

Level 1 is a static single-page app: React 19 + TypeScript (strict) + Vite. There's no backend and no runtime dependency beyond React and two self-hosted font packages, so it works fully offline once built.

## Layers

```text
data/curriculum/*.json     static content: weeks, mastery tests, resources
        │
src/curriculum/            assembles + validates content at startup
        │
src/lib/                   pure functions, no React
  progress.ts              week status, section completion, schedule, rebase, recovery, today's items
  mastery.ts               pass gate (passBlockers), re-check dates, stats
  activity.ts              streak, hours, heatmap series
  capability.ts            evidence-based maturity per capability area
  milestones.ts            detected + claimed milestones
  runway.ts, career.ts     planning aids and career evidence
  reminders.ts             contextual, dismissible nudges
  search.ts                index + query for the command palette
  schema.ts                factories / defaults (single source of default values)
  normalize.ts             repair + validate any stored or imported data
  backup.ts                export format, import parsing, schema migrations, v1 import
  storage.ts               IndexedDB → localStorage → memory, never throws without a status
        │
src/store/
  actions.ts               every state change as (AppData, …) → AppData, unit-testable
  store.tsx                provider: boot, debounced save, flush on hide, cross-tab guard, images, export
        │
src/features/<section>/    pages; lazy-loaded except Dashboard and Curriculum
src/components/            primitives (Button, fields, Dialog, Pill, Meter…), charts, domain widgets
```

## Principles in the code

- **Derive, don't store.** Week status, streaks, capability levels, milestones and career evidence are computed from records each render, so they can't drift from the truth. Only facts are stored (checked items, sessions, attempts, evidence).
- **Earned states can't be clicked.** A mastery test reaches *Passed* only through `recordMasteryPass`, which refuses while `passBlockers` returns anything. A week's *Prove* section with a mastery test completes only when that test passes. *Ship* needs evidence text.
- **Activities have refs.** Undoable actions (ticking a concept, marking a build step) write an activity with a stable `ref`. Undoing removes it, so streaks can't be farmed by toggling.
- **Never lose data silently.** Saves are debounced (350 ms) and flushed on `visibilitychange`/`pagehide`. If another tab saves, this tab pauses saving and asks you to reload. Unreadable data is quarantined and the app shows a recovery screen instead of overwriting it.
- **Hash routing** (`#/builds/b_…`) so any static host, or `vite preview`, works without rewrites.
- **Accessibility.** Native `<dialog>` for modals (focus trap, Esc), labelled fields, visible focus rings, radio-group semantics for segmented controls, a skip link, focus moved to the page heading on navigation, `prefers-reduced-motion` honoured (plus an in-app switch), tooltips mirrored by visually hidden tables.

## Persistence

| Store | Key | Contents |
|---|---|---|
| IndexedDB `level1-builder` / `state` | `app` | The whole `AppData` as JSON text |
| IndexedDB `level1-builder` / `images` | image id | Screenshot data URLs (resized to ≤1400 px, WebP) |
| IndexedDB `state` | `damaged-<ts>` | Quarantined unreadable data, if it ever happens |

Browser storage is per origin, so the app always runs on port 5180.

## Sync

`src/sync/` keeps devices in step through one private GitHub repository, with no server of our own:

- `github.ts`: a minimal REST client (contents API, `cache: 'no-store'` so stale SHAs never cause false conflicts; blobs API for files over 1 MB).
- `engine.ts`: the algorithm, independent of React and unit-tested against a fake repo. Remote unchanged + local edited → push; remote changed + local clean → adopt; both changed → newer `meta.updatedAt` wins and the other copy is stored as a snapshot. Writes carry the file SHA, so a concurrent write from another device returns 409 and the round retries.
- `SyncProvider.tsx`: when rounds run (start, focus, online, 6 s after edits, 2 min poll, on hide if dirty) and the status shown in the UI.
- `config.ts`: per-device settings in localStorage, **outside** `AppData`, so the token is never exported or synced. Also builds the pairing link (`#/connect/<base64url>`), which is removed from history as soon as it's read.

Remote layout: `level1/data.json` (`{ format: "level1-sync", schemaVersion, savedAt, device, data }`) and `level1/images/<id>.<ext>`.

## Testing

- `npm test`: vitest unit tests over `src/lib`, `src/store/actions` and `src/sync` (curriculum integrity, progress model, mastery gate, streak edge cases, schedule/rebase/recovery, runway, normalize, backup round-trip, v1 import, demo data; two simulated devices syncing through a fake repo, including collisions, retries, images and the public-repo refusal).
- The Definition of Done (open, onboard, complete a task, record a build, pass a mastery test, log, track an opportunity, portfolio, career, close a week, reopen, export, wipe, import) was walked end to end in headless Chrome before release.
