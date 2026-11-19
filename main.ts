// GTA 6 trophy guide — hand-in program (Node 22, standard library only).
//
// The guide is the static app/ folder in this repository: index.html, app.js,
// style.css and data/trophies.json, all plain files a browser opens offline
// with no build step and no network request. This program hands the guide in:
// it copies app/ and screenshots/ from beside this file into /output and
// writes /output/dossier.json, the summary the judge reads (the screenshots,
// the first load's files and bytes, and the source), using the vendored
// make.fun library. vendor/makefun-frontend.ts is the kit's copy, unchanged:
// the scorer requires dossier.json to be byte for byte what its own copy
// writes, so do not edit that file.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the guide locally with any static server, e.g.:
//   node --run serve   (or: npx serve app)  then open http://localhost:8080

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail fast with a clear message if the guide is incomplete, instead of
// handing in a half-empty /output that the scorer would refuse.
const appDir = join(here, 'app');
const dataFile = join(appDir, 'data', 'trophies.json');
if (!existsSync(appDir)) throw new Error('missing app/ beside main.ts');
if (!existsSync(dataFile)) throw new Error('missing app/data/trophies.json');
if (!existsSync(join(appDir, 'index.html'))) throw new Error('missing app/index.html');

mkdirSync(out, { recursive: true });
cpSync(appDir, join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps from the bounty gate: at most 4 screenshots, each at most 256 KiB;
// app/ at most 993 files and directories and 48 MiB in all. Only
// text_max_bytes shapes the dossier's bytes; the other caps refuse an entry
// the scorer would refuse.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// Confirm what was handed in, so a runner can see at a glance that the
// output is complete before submitting.
const shotCount = existsSync(join(out, 'screenshots'))
  ? readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.')).length
  : 0;
console.log(`handed in ${out}: app/ + ${shotCount} screenshot(s) + dossier.json (${dossier.length} bytes)`);
