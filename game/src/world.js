// The game's rules and state, with no drawing and no browser in it: the chef, the pizza
// that travels from dough bench to oven to box to window, the orders, the oven slots,
// the score, the combo and the hearts. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react without the world knowing about screens
// or sound. Nothing here allocates after createWorld returns, except the small arrays an
// order or a pizza needs when it is born.
import {
  BINS, BOX_SECONDS, CHEF, COMBO_WINDOW, DOUGH_SECONDS, FIELD, HEARTS,
  ORDERS, OVEN, RECIPES, SHIFT_SECONDS, STATIONS, USE_RANGE,
} from './config.js';

export const EVENT_SERVE = 1;
export const EVENT_REFUSE = 2;
export const EVENT_EXPIRE = 4;
export const EVENT_OVER = 8;
export const EVENT_BURN = 16;

/** A pizza is ready for the oven once it has sauce and cheese on it. */
export function readyForOven(pizza) {
  return pizza !== null && pizza.toppings.includes('saus') && pizza.toppings.includes('keju');
}

/** True when the pizza's topping set is exactly the recipe's set, order aside. */
export function matchesRecipe(pizza, recipe) {
  if (pizza === null || pizza.toppings.length !== recipe.toppings.length) return false;
  for (const topping of recipe.toppings) {
    if (!pizza.toppings.includes(topping)) return false;
  }
  return true;
}

function bakeQuality(bakeT) {
  if (bakeT < OVEN.perfectMin) return 'raw';
  if (bakeT <= OVEN.perfectMax) return 'perfect';
  if (bakeT <= OVEN.okMax) return 'ok';
  return 'burnt';
}

function distanceToRect(x, y, rect) {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.w));
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

/** Every usable station, bins included, as one flat list. */
function allStations() {
  return [
    STATIONS.dough,
    STATIONS.oven,
    STATIONS.box,
    STATIONS.serve,
    STATIONS.trash,
    ...BINS,
  ];
}

export function nearestStation(x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const station of allStations()) {
    const distance = distanceToRect(x, y, station);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = station;
    }
  }
  return bestDistance <= USE_RANGE ? best : null;
}

export function createWorld(random) {
  const chef = { x: FIELD.width / 2, y: 430, face: 1 };
  const ovenSlots = [];
  for (let index = 0; index < OVEN.slots; index += 1) {
    ovenSlots.push({ pizza: null, bakeT: 0, burnAnnounced: false });
  }
  const state = {
    chef,
    carried: null,
    ovenSlots,
    orders: [],
    coins: 0,
    served: 0,
    combo: 0,
    comboTimer: 0,
    hearts: HEARTS,
    timeLeft: SHIFT_SECONDS,
    elapsed: 0,
    orderTimer: ORDERS.firstAfter,
    nextOrderId: 1,
    channel: null,
    message: null,
    messageUntil: 0,
    over: false,
  };

  function reset() {
    chef.x = FIELD.width / 2;
    chef.y = 430;
    chef.face = 1;
    state.carried = null;
    for (const slot of ovenSlots) {
      slot.pizza = null;
      slot.bakeT = 0;
      slot.burnAnnounced = false;
    }
    state.orders.length = 0;
    state.coins = 0;
    state.served = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.hearts = HEARTS;
    state.timeLeft = SHIFT_SECONDS;
    state.elapsed = 0;
    state.orderTimer = ORDERS.firstAfter;
    state.nextOrderId = 1;
    state.channel = null;
    state.message = null;
    state.messageUntil = 0;
    state.over = false;
  }

  function say(text, seconds) {
    state.message = text;
    state.messageUntil = state.elapsed + (seconds ?? 2);
  }

  function spawnOrder() {
    if (state.orders.length >= ORDERS.maxOpen) return;
    const progress = Math.min(1, state.elapsed / SHIFT_SECONDS);
    const patience = ORDERS.patienceStart + (ORDERS.patienceEnd - ORDERS.patienceStart) * progress;
    const recipe = RECIPES[Math.floor(random() * RECIPES.length)];
    state.orders.push({
      id: state.nextOrderId,
      recipe,
      patience,
      maxPatience: patience,
    });
    state.nextOrderId += 1;
  }

  function orderInterval() {
    const progress = Math.min(1, state.elapsed / SHIFT_SECONDS);
    return ORDERS.intervalStart + (ORDERS.intervalEnd - ORDERS.intervalStart) * progress;
  }

  function finishChannel() {
    const channel = state.channel;
    state.channel = null;
    if (channel.kind === 'dough') {
      state.carried = { toppings: [], quality: null, boxed: false, bakeT: 0 };
    } else if (channel.kind === 'box' && state.carried !== null) {
      state.carried.boxed = true;
    }
  }

  function useStation(station) {
    const carried = state.carried;
    if (station.kind === 'dough') {
      if (carried !== null) { say('Tangan sudah penuh!'); return EVENT_REFUSE; }
      state.channel = { kind: 'dough', t: 0, duration: DOUGH_SECONDS };
      return 0;
    }
    if (station.kind === 'bin') {
      if (carried === null) { say('Ambil adonan dulu!'); return EVENT_REFUSE; }
      if (carried.boxed) { say('Pizza sudah dikemas!'); return EVENT_REFUSE; }
      if (carried.quality !== null) { say('Sudah dipanggang!'); return EVENT_REFUSE; }
      if (carried.toppings.includes(station.topping)) { say('Sudah ada!'); return EVENT_REFUSE; }
      carried.toppings.push(station.topping);
      return 0;
    }
    if (station.kind === 'oven') {
      if (carried !== null) {
        if (!readyForOven(carried)) { say('Butuh saus + keju dulu!'); return EVENT_REFUSE; }
        const free = ovenSlots.find((slot) => slot.pizza === null);
        if (free === undefined) { say('Oven penuh!'); return EVENT_REFUSE; }
        free.pizza = carried;
        free.bakeT = 0;
        free.burnAnnounced = false;
        state.carried = null;
        return 0;
      }
      let bestSlot = null;
      for (const slot of ovenSlots) {
        if (slot.pizza !== null && (bestSlot === null || slot.bakeT > bestSlot.bakeT)) bestSlot = slot;
      }
      if (bestSlot === null) { say('Oven kosong!'); return EVENT_REFUSE; }
      const pizza = bestSlot.pizza;
      pizza.bakeT = bestSlot.bakeT;
      pizza.quality = bakeQuality(bestSlot.bakeT);
      bestSlot.pizza = null;
      bestSlot.bakeT = 0;
      state.carried = pizza;
      if (pizza.quality === 'burnt') say('Gosong! Buang dulu.');
      else if (pizza.quality === 'raw') say('Masih mentah!');
      return 0;
    }
    if (station.kind === 'box') {
      if (carried === null) { say('Tidak ada pizza!'); return EVENT_REFUSE; }
      if (carried.quality === null) { say('Masukkan oven dulu!'); return EVENT_REFUSE; }
      if (carried.quality === 'burnt') { say('Gosong! Buang dulu.'); return EVENT_REFUSE; }
      if (carried.quality === 'raw') { say('Masih mentah!'); return EVENT_REFUSE; }
      if (carried.boxed) { say('Sudah dikemas!'); return EVENT_REFUSE; }
      state.channel = { kind: 'box', t: 0, duration: BOX_SECONDS };
      return 0;
    }
    if (station.kind === 'serve') {
      if (carried === null) { say('Tidak ada pizza!'); return EVENT_REFUSE; }
      if (!carried.boxed) { say('Kemas dulu di Meja Kotak!'); return EVENT_REFUSE; }
      const orderIndex = state.orders.findIndex((order) => matchesRecipe(carried, order.recipe));
      if (orderIndex === -1) { say('Tidak ada yang pesan ini!'); return EVENT_REFUSE; }
      const order = state.orders[orderIndex];
      state.orders.splice(orderIndex, 1);
      const speedBonus = Math.round(6 * (order.patience / order.maxPatience));
      const perfectBonus = carried.quality === 'perfect' ? 3 : 0;
      state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
      state.comboTimer = COMBO_WINDOW;
      const comboBonus = 2 * (state.combo - 1);
      const earned = order.recipe.price + speedBonus + perfectBonus + comboBonus;
      state.coins += earned;
      state.served += 1;
      state.carried = null;
      say(`+${earned} koin${state.combo > 1 ? ` · kombo x${state.combo}` : ''}`, 2.5);
      return EVENT_SERVE;
    }
    if (station.kind === 'trash') {
      if (carried === null) { say('Tidak ada yang dibuang!'); return EVENT_REFUSE; }
      state.carried = null;
      say('Dibuang.');
      return 0;
    }
    return 0;
  }

  /**
   * One fixed step. `input` is { dx, dy, use }: the chef's move direction and whether
   * the use key was pressed this step. With `harmless` set (the title screen's backdrop)
   * orders drift in but the clock never runs and nothing is lost.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;

    if (harmless) {
      if (state.orders.length < 2) {
        state.orderTimer -= dt;
        if (state.orderTimer <= 0) {
          spawnOrder();
          state.orderTimer = orderInterval();
        }
      }
      return events;
    }
    if (state.over) return events;

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.over = true;
      return EVENT_OVER;
    }

    state.orderTimer -= dt;
    if (state.orderTimer <= 0) {
      spawnOrder();
      state.orderTimer = orderInterval();
    }

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    for (let index = state.orders.length - 1; index >= 0; index -= 1) {
      const order = state.orders[index];
      order.patience -= dt;
      if (order.patience <= 0) {
        state.orders.splice(index, 1);
        state.hearts -= 1;
        say('Pesanan hangus! -1 hati', 2.5);
        events |= EVENT_EXPIRE;
        if (state.hearts <= 0) {
          state.over = true;
          return events | EVENT_OVER;
        }
      }
    }

    for (const slot of ovenSlots) {
      if (slot.pizza === null) continue;
      slot.bakeT += dt;
      if (slot.bakeT > OVEN.okMax && !slot.burnAnnounced) {
        slot.burnAnnounced = true;
        say('Pizza gosong di oven!', 2.5);
        events |= EVENT_BURN;
      }
    }

    if (state.channel !== null) {
      state.channel.t += dt;
      if (state.channel.t >= state.channel.duration) finishChannel();
      return events;
    }

    const dx = input.dx || 0;
    const dy = input.dy || 0;
    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy);
      chef.x = Math.min(FIELD.width - 16, Math.max(16, chef.x + (dx / length) * CHEF.speed * dt));
      chef.y = Math.min(FIELD.height - 16, Math.max(164, chef.y + (dy / length) * CHEF.speed * dt));
      if (dx !== 0) chef.face = dx > 0 ? 1 : -1;
    }

    if (input.use) {
      const station = nearestStation(chef.x, chef.y);
      if (station === null) say('Terlalu jauh dari stasiun!');
      else events |= useStation(station);
    }

    return events;
  }

  reset();
  return { state, reset, step };
}
