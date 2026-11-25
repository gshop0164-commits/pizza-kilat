// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over. A click
// on the floor walks the chef there; a click on a station walks there and uses it.
//
// ?seed=N fixes the order pattern. ?shot=start|play|serve|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BURN, EVENT_EXPIRE, EVENT_OVER, EVENT_REFUSE, EVENT_SERVE, nearestStation } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_USE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

/** Client pixels to playfield pixels, mirroring the renderer's own scaling. */
function toField(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = rect.width * ratio;
  const height = rect.height * ratio;
  const scale = Math.min(width / FIELD.width, height / FIELD.height);
  const offsetX = (width - FIELD.width * scale) / 2;
  const offsetY = (height - FIELD.height * scale) / 2;
  const x = ((clientX - rect.left) * ratio - offsetX) / scale;
  const y = ((clientY - rect.top) * ratio - offsetY) / scale;
  if (x < 0 || x > FIELD.width || y < 0 || y > FIELD.height) return null;
  return { x, y };
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, toField);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let pendingUse = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each serve.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Bermain. 3 hati. Sajikan pizza sebelum waktunya habis.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.coins > best) {
      best = world.state.coins;
      saveBest(best);
    }
    announce(`Shift selesai. Koin ${world.state.coins}. Pizza disajikan ${world.state.served}. Terbaik ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Bermain.');
    }
    if (actions & ACTION_USE) pendingUse = true;
  }

  function stepInput() {
    const keys = input.keys();
    let dx = keys.x;
    let dy = keys.y;
    const target = input.walk();
    if ((dx === 0 && dy === 0) && target !== null) {
      const chef = world.state.chef;
      const tx = target.x - chef.x;
      const ty = target.y - chef.y;
      if (Math.hypot(tx, ty) < 12) {
        const useOnArrival = input.walkUse();
        input.clearWalk();
        if (useOnArrival) pendingUse = true;
      } else {
        dx = tx;
        dy = ty;
      }
    } else if (dx !== 0 || dy !== 0) {
      input.clearWalk();
    }
    const use = pendingUse;
    pendingUse = false;
    return { dx, dy, use };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { dx: 0, dy: 0, use: false }, true);
      return;
    }
    const events = world.step(STEP, stepInput(), false);
    if (events & EVENT_SERVE) announce(`Disajikan! Koin ${world.state.coins}.`);
    else if (events & EVENT_EXPIRE) announce(`Pesanan hangus. ${world.state.hearts} hati tersisa.`);
    else if (events & EVENT_BURN) announce('Pizza gosong di oven!');
    else if (events & EVENT_REFUSE) announce(world.state.message ?? 'Tidak bisa.');
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const near = screen === SCREEN_PLAY ? nearestStation(world.state.chef.x, world.state.chef.y) : null;
    renderer.draw(world.state, screen, best, near);
  }

  // Leaving the tab pauses a running game rather than letting orders expire unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Pizza Kilat. Tekan Spasi atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
