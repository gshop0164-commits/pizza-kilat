// The screenshot scenes behind ?shot=start|play|serve|end. Each one plays the real rules
// forward from a fresh world, steered by a simple autopilot that works one order at a time
// (dough, sauce and toppings, oven, box, serve), so the frame is what a short game really
// looks like and the same seed always gives the same frame. The start scene stages the
// kitchen by hand (a pizza mid-assembly on the bench, one baking) but still draws the real
// world state, with the title banner kept over open floor so the kitchen stays visible.
import { BINS, FIELD, OVEN, RECIPES, STATIONS, STEP } from './config.js';
import { EVENT_OVER, EVENT_SERVE, nearestStation } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 7;
const PLAY_SECONDS = 45;
const SERVE_LIMIT_SECONDS = 120;
const END_LIMIT_SECONDS = 200;

/** Where the chef stands to use each station. */
function standPoint(station) {
  if (station.kind === 'bin') return { x: station.x + station.w + 44, y: station.y + station.h / 2 };
  // (bins sit in one column down the left wall, so standing right of one is nearest to it)
  if (station.kind === 'dough') return { x: station.x + station.w / 2, y: station.y + station.h + 44 };
  if (station.kind === 'oven') return { x: station.x + station.w / 2, y: station.y + station.h + 44 };
  if (station.kind === 'box') return { x: station.x + station.w / 2, y: station.y - 44 };
  if (station.kind === 'serve') return { x: station.x + 44, y: station.y - 44 };
  if (station.kind === 'trash') return { x: station.x + station.w / 2, y: station.y - 44 };
  return { x: FIELD.width / 2, y: 430 };
}

function binFor(topping) {
  return BINS.find((bin) => bin.topping === topping);
}

/** A pilot that works the oldest order, one station at a time. */
function makePilot() {
  let orderId = null;
  let stepIndex = 0;
  let waitingBake = false;

  function planFor(state) {
    const order = state.orders[0];
    if (order === undefined) return null;
    const steps = [{ station: STATIONS.dough }];
    for (const topping of order.recipe.toppings) steps.push({ station: binFor(topping) });
    steps.push({ station: STATIONS.oven, put: true });
    steps.push({ station: STATIONS.oven, take: true });
    steps.push({ station: STATIONS.box });
    steps.push({ station: STATIONS.serve });
    return { order, steps };
  }

  function currentStep(state) {
    const plan = planFor(state);
    if (plan === null) return null;
    if (plan.order.id !== orderId) {
      orderId = plan.order.id;
      stepIndex = 0;
      waitingBake = false;
    }
    if (stepIndex >= plan.steps.length) return null;
    return plan.steps[stepIndex];
  }

  function advance(state) {
    stepIndex += 1;
    waitingBake = false;
  }

  /** Returns { dx, dy, use } for one fixed step. */
  function drive(state) {
    const carried = state.carried;
    // A pizza that matches no open order is dead weight: throw it away.
    if (carried !== null && carried.quality !== 'burnt') {
      const wanted = state.orders.some((order) => {
        if (carried.toppings.length > order.recipe.toppings.length) return false;
        return carried.toppings.every((topping) => order.recipe.toppings.includes(topping));
      });
      if (!wanted) {
        const target = standPoint(STATIONS.trash);
        const dx = target.x - state.chef.x;
        const dy = target.y - state.chef.y;
        if (Math.hypot(dx, dy) < 10) {
          if (nearestStation(state.chef.x, state.chef.y) === STATIONS.trash) return { dx: 0, dy: 0, use: true };
          return { dx: 0, dy: 0, use: false };
        }
        return { dx, dy, use: false };
      }
    }
    if (carried !== null && carried.quality === 'burnt') {
      const target = standPoint(STATIONS.trash);
      const dx = target.x - state.chef.x;
      const dy = target.y - state.chef.y;
      if (Math.hypot(dx, dy) < 10) return { dx: 0, dy: 0, use: true };
      return { dx, dy, use: false };
    }

    const step = currentStep(state);
    if (step === null) {
      // Nothing to do: drift toward the middle of the floor.
      const dx = FIELD.width / 2 - state.chef.x;
      const dy = 430 - state.chef.y;
      if (Math.hypot(dx, dy) < 10) return { dx: 0, dy: 0, use: false };
      return { dx, dy, use: false };
    }

    // Wait out a channel (dough stretching, boxing) instead of walking away.
    if (state.channel !== null) return { dx: 0, dy: 0, use: false };

    // Step completion checks, before moving.
    if (step.station.kind === 'dough' && carried !== null) { advance(state); return drive(state); }
    if (step.station.kind === 'bin' && carried !== null && carried.toppings.includes(step.station.topping)) {
      advance(state);
      return drive(state);
    }
    if (step.put && carried === null) { advance(state); return drive(state); }
    if (step.take && carried !== null) { advance(state); return drive(state); }
    if (step.station.kind === 'box' && carried !== null && carried.boxed) { advance(state); return drive(state); }
    if (step.station.kind === 'serve' && carried === null) { advance(state); return drive(state); }

    const target = standPoint(step.station);
    const dx = target.x - state.chef.x;
    const dy = target.y - state.chef.y;
    if (Math.hypot(dx, dy) >= 10) return { dx, dy, use: false };

    // Arrived: use the station, unless this is the oven take and the bake is not ready.
    if (step.take) {
      const slot = state.ovenSlots.find((entry) => entry.pizza !== null);
      if (slot === undefined) { advance(state); return drive(state); }
      if (slot.bakeT < OVEN.perfectMin + 0.3 || slot.bakeT > OVEN.perfectMax - 0.2) {
        return { dx: 0, dy: 0, use: false };
      }
      return { dx: 0, dy: 0, use: true };
    }
    if (nearestStation(state.chef.x, state.chef.y) !== step.station) return { dx: 0, dy: 0, use: false };
    return { dx: 0, dy: 0, use: true };
  }

  return { drive };
}

/**
 * Set `world` to the named scene (start, play, serve or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const pilot = makePilot();
  world.reset();

  if (name !== 'play' && name !== 'serve' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { dx: 0, dy: 0, use: false }, true);
    // The board needs two orders for the cover: the first drifts in at 6 s, so add one.
    if (world.state.orders.length < 2) {
      world.state.orders.push({
        id: world.state.nextOrderId,
        recipe: RECIPES[1],
        patience: 50,
        maxPatience: 50,
      });
      world.state.nextOrderId += 1;
    }
    // Stage the cover: a pizza mid-assembly in the chef's hands by the dough bench,
    // one baking in the oven, two orders on the board.
    world.state.chef.x = STATIONS.dough.x + STATIONS.dough.w / 2;
    world.state.chef.y = STATIONS.dough.y + STATIONS.dough.h + 60;
    world.state.carried = { toppings: ['saus', 'keju', 'pepperoni'], quality: null, boxed: false, bakeT: 0 };
    world.state.ovenSlots[0].pizza = { toppings: ['saus', 'keju', 'jamur'], quality: null, boxed: false, bakeT: 0 };
    world.state.ovenSlots[0].bakeT = 4;
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'play') {
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      if (world.step(STEP, pilot.drive(world.state), false) & EVENT_OVER) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.coins };
  }

  if (name === 'serve') {
    let served = false;
    for (let index = 0; index < SERVE_LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, pilot.drive(world.state), false);
      if (events & EVENT_SERVE) { served = true; break; }
      if (events & EVENT_OVER) break;
    }
    if (!served) return { screen: SCREEN_PLAY, best: world.state.coins };
    // Keep playing until the chef is carrying a boxed pizza toward the window.
    for (let index = 0; index < SERVE_LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, pilot.drive(world.state), false);
      if (world.state.carried !== null && world.state.carried.boxed) break;
      if (events & EVENT_OVER) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.coins };
  }

  for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
    if (world.step(STEP, pilot.drive(world.state), false) & EVENT_OVER) break;
  }
  return { screen: SCREEN_OVER, best: world.state.coins };
}
