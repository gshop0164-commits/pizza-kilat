// Pizza Kilat: the hand-in program for the best-cooking-game-20261125-0137 bounty
// (Node 22, standard library only). The game is this directory's game/ folder, plain
// static files a desktop browser loads offline (game/index.html and its ES modules, no
// library and no network request). This program checks the hand-in first, then copies
// game/ and screenshots/ from beside this file to /output and writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const shotsDir = join(here, 'screenshots');

function fail(message) {
  throw new Error(`pizza-kilat hand-in refused: ${message}`);
}

// The scorer's own caps (from the kit's RULES.txt): 3 or 4 screenshots, each at most
// 256 KiB, and a game/index.html that exists. Refuse early, with a plain reason, rather
// than handing in an entry the gate would refuse.
if (!existsSync(join(here, 'game', 'index.html'))) fail('game/index.html is missing');
if (!existsSync(shotsDir)) fail('screenshots/ is missing');
const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.')).sort();
if (shots.length < 3 || shots.length > 4) fail(`screenshots/ holds ${shots.length} images, need 3 or 4`);
for (const shot of shots) {
  const bytes = statSync(join(shotsDir, shot)).size;
  if (bytes > 262144) fail(`${shot} is ${bytes} bytes, over the 256 KiB cap`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the
// others refuse an entry the scorer would refuse (more than 4 screenshots or one over
// 256 KiB; more than 993 files in game/ or 48 MiB of game files, in all, or a path under
// game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

const gameBytes = readdirSync(join(out, 'game'), { recursive: true }).length;
console.log(`Pizza Kilat handed in: ${shots.length} screenshots, ${gameBytes} game entries -> ${out}`);
