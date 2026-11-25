// Keyboard and pointer input. Held keys steer the chef; one-shot presses (start or
// restart, pause, use) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. A click on the floor sets a
// walk target; a click on a station walks there and uses it on arrival.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_USE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const USE = new Set(['KeyE']);

export function createInput(target, toField) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  /** Where the chef walks to after a click, in playfield pixels, or null. */
  let walkTarget = null;
  /** Whether to use a station when the walk target is reached. */
  let walkUse = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (USE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_USE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
  });
  target.addEventListener('pointerdown', (event) => {
    const point = toField(event.clientX, event.clientY);
    if (point) {
      walkTarget = point;
      walkUse = true;
    }
    actions |= ACTION_CONFIRM;
  });

  return {
    /** -1, 0 or 1 on each axis, from the held keys. */
    keys() {
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The click walk target, or null; cleared by clearWalk. */
    walk() {
      return walkTarget;
    },
    walkUse() {
      return walkUse;
    },
    clearWalk() {
      walkTarget = null;
      walkUse = false;
    },
  };
}
