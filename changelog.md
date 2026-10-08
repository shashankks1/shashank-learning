# Changelog

## 2.1.0 — 2026-10-08

- **Deployed to GitHub Pages** from the `gh-pages` branch; `npm run deploy` tests, builds and publishes.
- **Automatic sync across devices** through a private GitHub repo: pulls on open/focus, pushes after edits, polls every 2 minutes; newer-wins on collisions with the other copy kept; screenshots synced as separate files; refuses public repos; never uploads demo data.
- **Phone pairing** by QR code or link (the token is stripped from the address bar on open).
- Home-screen install: web-app manifest, icons, safe-area padding.
- Backup reminder stays quiet while sync is keeping a copy on GitHub.

## 2.0.0 — 2026-10-07

Rebuilt as a full platform (React + TypeScript + Vite, local-first).

- **Curriculum**: the 52-week structure, every week framed as Learn → Practice → Build → Prove → Reflect → Ship, with a Try First task (attempt → hint → explanation → solution) and curated resources. Today / Week / Month / Year views with status filters.
- **Mastery**: 15 capability tests. A pass is gated on criteria, evidence, reflection, constraints and AI ownership; passes come back for a re-check after 60 days, and can be withdrawn.
- **Builds, Build Log, Debug mode, Opportunity Lab, Portfolio (5 proofs), Career** (stages, experiments, income, milestones, runway calculator), **Resources**, **Capability Report**.
- **Dashboard** answering the five questions, with separate progress tracks, an evidence-based capability map, hours chart, activity heatmap, reminders and the recovery protocol.
- Weekly review with Continue / Rebase; rebasing never erases history.
- Real streak from dated activity (configurable), session timer and manual time logging.
- Command palette (<kbd>Ctrl</kbd>+<kbd>K</kbd>), keyboard navigation, light/dark themes, mobile layout.
- Offline coach with four modes (Teacher, Coach, Debugger, Challenger).
- IndexedDB persistence, JSON export/import with confirmation, damaged-data recovery, schema versioning, import of v1 backups.
- Realistic demo data (a learner in Week 3), Reset Demo Data and Start Fresh.

## 1.0.0 — 2026-10-05

Single-file curriculum page (`level-1-builder-curriculum.html`): 56 weeks, notes, opportunity lab, build log, portfolio proofs, localStorage backup.
