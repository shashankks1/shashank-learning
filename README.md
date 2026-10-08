# Level 1 — Product-Minded AI Builder

**Protect the floor. Raise the ceiling.**

A local-first personal apprenticeship system: 52 weeks from semantic HTML to a product real people use, built around a full-time job. It tracks what you can *show*, not what you've consumed. That covers builds, mastery tests passed with evidence, an engineering log, opportunity research, a five-rung portfolio, and career and earning-power evidence.

No backend and no account. Your data lives in your browser, and optionally syncs across your devices through a **private** GitHub repo you own.

**Live:** https://shashankks1.github.io/shashank-learning/. Open it on any device. On a phone, use *Add to Home Screen* and it opens like an app.

## Run it locally

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm start          # builds, then opens http://localhost:5180
```

On Windows you can double-click **`start.cmd`** instead.

While changing the code, use `npm run dev` (same address, with hot reload). Dev and preview share port 5180 on purpose. Browser storage belongs to an address, so a fixed port means you see the same data whichever one you run.

| Command | What it does |
|---|---|
| `npm start` | Production build + local server, opens the browser |
| `npm run dev` | Development server with hot reload |
| `npm test` | Unit tests (progress model, mastery gate, streak, runway, backup/import, v1 migration) |
| `npm run typecheck` | TypeScript, strict |
| `npm run build` | Type-check + production build into `dist/` |

## Deploying

```bash
npm run deploy     # tests → build → publish dist/ to the gh-pages branch
```

GitHub Pages serves the `gh-pages` branch. One-time setup: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `gh-pages` / root**. Free accounts need the repo to be public for Pages. That's fine, because the repo only holds the app and the curriculum.

Want deploys to happen automatically on every push instead? Add a GitHub Actions Pages workflow. Pushing workflow files needs a token with the `workflow` scope.

## Sync across devices

Each browser keeps its own copy, so sync keeps your phone and laptop in step automatically:

1. Create a **private** repo for your data, e.g. `level-1-data`. The app refuses to sync to a public repo.
2. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to **only that repo** and **Contents: Read and write**.
3. In the app: **Settings → Sync** → paste `your-username/level-1-data` and the token → *Connect and sync*.
4. On your phone: on the laptop, choose **Connect another device** and scan the QR code. It opens the app connected and pulls your data.

Sync runs on open, when you return to the app, ~6 seconds after you stop editing, and every 2 minutes while open. If both devices were edited offline, the newer copy wins and the other is kept under *Settings → Sync → Saved copies*; nothing is silently lost. Every sync is a commit, so the data repo also gives you full history. The token is stored only on the device, and is never exported or synced. Demo data is never uploaded.

## Your data

- **Stored in IndexedDB** in this browser. It falls back to localStorage, and then to memory-only with a warning, if storage is blocked.
- **Export** (Settings, sidebar, or <kbd>Ctrl</kbd>+<kbd>K</kbd> → "Export backup") downloads a JSON file with everything, including screenshots. Put it in `backups/`, which is git-ignored, or anywhere outside the browser.
- **Import** asks before replacing anything (*Cancel / Export Backup / Import Anyway*). Invalid files are refused and your data is left untouched.
- **v1 backups** from the original single-page curriculum (`level-1-builder-curriculum.html`) import too. Opportunities, build log, notes and portfolio evidence carry over. Week ticks don't, because the curriculum order changed.
- Income and savings can be excluded from exports (Settings) and hidden on screen (Career).
- A gentle reminder appears when you haven't exported in 14 days (configurable).
- If saved data is ever unreadable, the app stops and offers to download the damaged copy, restore a backup, or start again. It never overwrites silently.

**Never commit backups or personal data.** The repo holds the app and the curriculum only.

## What's inside

| Section | What it's for |
|---|---|
| **Dashboard** | Where am I · what to do today · what I'm building · what I'm proving · what evidence I have |
| **Curriculum** | Today / Week / Month / Year views. Each week runs Learn → Practice → Build → Prove → Reflect → Ship, with Try First, resources, time and notes |
| **Builds** | Projects with status, links, screenshot, what broke, and an AI-ownership check |
| **Mastery** | 15 capability tests. A pass needs every criterion, the required evidence, a reflection, constraint confirmation and AI ownership. Passes come back for a no-notes re-check after 60 days |
| **Opportunity Lab** | Problems observed in the world: evidence log, nine assessment dimensions, deliberately no total score |
| **Portfolio** | Five proofs of increasing capability, from frontend craft to the capstone |
| **Build Log** | Engineering journal plus **Debug mode** (reproduce → observe → hypothesise → inspect → change one thing → test → document) |
| **Career** | Current vs target, nine-stage path, experiments, income trajectory, milestones, private runway calculator |
| **Resources** | Official docs first; this week's resources on top |
| **Capability Report** | The Year 1 report, generated from your records, printable |

Weekly review ends in **Continue** (close the week) or **Rebase** (give it another week). Rebasing shifts the plan and never erases history. The recovery protocol escalates gently: about a week away, resume. Two to three weeks, reassess the workload. More than three, a re-entry plan.

The **coach** (Teacher / Coach / Debugger / Challenger) works offline. It asks before it tells, and can hand you a prompt that carries the same rules to whatever AI assistant you use. Nothing is sent anywhere by this app.

### Keyboard

<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> palette and search · <kbd>g</kbd> then <kbd>d c b m o p l j r s y</kbd> to jump between sections · <kbd>t</kbd> start/stop the timer · <kbd>?</kbd> all shortcuts.

## Project structure

```text
├── index.html
├── public/                    web-app manifest + home-screen icons
├── scripts/deploy.mjs         publishes dist/ to the gh-pages branch
├── start.cmd                  double-click launcher (Windows)
├── data/curriculum/           the 52-week curriculum, one JSON file per month
│   ├── meta.json              principles, capability areas, portfolio slots
│   └── month-01.json … 12     weeks, Try First tasks, resources, mastery tests
├── src/
│   ├── types.ts               the data model (schema v2)
│   ├── curriculum/            loads + validates the curriculum
│   ├── lib/                   pure logic: progress, mastery, streak, runway, search, backup, storage…
│   ├── store/                 state provider (debounced persistence) + pure actions
│   ├── sync/                  GitHub client, sync engine, provider (automatic device sync)
│   ├── components/            UI primitives, charts, domain widgets
│   ├── features/              one folder per section
│   └── styles/                tokens (light + dark), base, components, shell, pages
├── tests/                     vitest unit tests
├── docs/                      architecture + data model
├── backups/                   your exports (git-ignored)
├── assets/mark.svg            personal mark
├── changelog.md
└── level-1-builder-curriculum.html   v1, kept for reference
```

## Editing the curriculum

Each month is a plain JSON file in `data/curriculum/`. Change a week's concepts, build, resources or Try First task there; the app picks it up on the next build. `npm test` checks that week numbers, months and mastery links stay consistent. Progress is keyed by week number and item position, so **reordering items inside a week** will shift which boxes appear ticked. Prefer adding to the end.

See [docs/architecture.md](docs/architecture.md) and [docs/data-model.md](docs/data-model.md).
