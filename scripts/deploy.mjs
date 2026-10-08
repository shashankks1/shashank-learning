// Publish dist/ to the gh-pages branch, which GitHub Pages serves.
// Run via `npm run deploy` (tests and build run first).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ is missing. Run `npm run build` first.');
  process.exit(1);
}

const remote = git(['remote', 'get-url', 'origin']);
const source = git(['rev-parse', '--short', 'HEAD']);
const dirty = git(['status', '--porcelain']).length > 0;
const name = git(['config', 'user.name']);
const email = git(['config', 'user.email']);

// Pages runs Jekyll by default; this file turns it off so every file is served as built.
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
const nested = path.join(dist, '.git');
fs.rmSync(nested, { recursive: true, force: true });

try {
  git(['init', '-q'], dist);
  git(['checkout', '-q', '-b', 'gh-pages'], dist);
  git(['add', '-A'], dist);
  git(['-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-q', '-m', `Deploy ${source}${dirty ? ' (with uncommitted changes)' : ''} · ${new Date().toISOString()}`], dist);
  git(['push', '--force', '-q', remote, 'gh-pages'], dist);
} finally {
  fs.rmSync(nested, { recursive: true, force: true });
}

const match = remote.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?$/);
console.log(`Deployed ${source}${dirty ? ' + uncommitted changes' : ''} to gh-pages.`);
if (match) console.log(`Live in about a minute: https://${match[1]}.github.io/${match[2]}/`);
