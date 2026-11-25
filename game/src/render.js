// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Flat shapes, canvas gradients for the oven fire, and canvas text for the HUD
// and the panels. Text that holds a number is rebuilt only when the number changes, so
// a frame allocates nothing.
import { BINS, CHEF, FIELD, FONT, HEARTS, OVEN, PALETTE, SHIFT_SECONDS, STATIONS, TOPPING_INFO } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** The title banner sits over open floor, never over the benches or the oven. */
const BANNER = { x: 300, y: 452, w: 680, h: 128 };
const PANEL = { width: 560, top: 120, line: 32, bottom: 64 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const coinsLabel = cachedLabel('Koin ');
  const comboLabel = cachedLabel('Kombo x');
  const finalLabel = cachedLabel('Koin ');
  const servedLabel = cachedLabel('Pizza disajikan ');
  const bestLabel = cachedLabel('Terbaik ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    const key = `${size}${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  /** One topping drawn as a small garnish, at (x, y) with radius r. */
  function drawToppingPiece(id, x, y, r) {
    const info = TOPPING_INFO[id];
    if (id === 'saus') {
      context.fillStyle = info.color;
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
    } else if (id === 'keju') {
      context.fillStyle = info.color;
      context.beginPath();
      context.arc(x, y, r * 0.9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff3c4';
      context.beginPath();
      context.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2);
      context.fill();
    } else if (id === 'pepperoni') {
      context.fillStyle = info.color;
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#e88a7a';
      context.beginPath();
      context.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, Math.PI * 2);
      context.arc(x + r * 0.3, y + r * 0.25, r * 0.18, 0, Math.PI * 2);
      context.fill();
    } else if (id === 'jamur') {
      context.fillStyle = info.color;
      context.beginPath();
      context.arc(x, y - r * 0.2, r * 0.95, Math.PI, 0);
      context.fill();
      context.fillRect(x - r * 0.25, y - r * 0.2, r * 0.5, r * 0.7);
    } else if (id === 'paprika') {
      context.save();
      context.translate(x, y);
      context.rotate(0.6);
      context.fillStyle = info.color;
      roundRect(-r, -r * 0.35, r * 2, r * 0.7, r * 0.3);
      context.fill();
      context.restore();
    } else if (id === 'zaitun') {
      context.fillStyle = info.color;
      context.beginPath();
      context.arc(x, y, r * 0.85, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.sauce;
      context.beginPath();
      context.arc(x, y, r * 0.35, 0, Math.PI * 2);
      context.fill();
    }
  }

  /** A pizza, seen from above: golden crust, red sauce, melting cheese, toppings. */
  function drawPizza(cx, cy, r, pizza, elapsed) {
    const burnt = pizza.quality === 'burnt';
    context.fillStyle = burnt ? '#3a2418' : PALETTE.crust;
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = burnt ? '#2a1a10' : PALETTE.crustDark;
    context.beginPath();
    context.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
    context.fill();
    if (pizza.toppings.includes('saus')) {
      context.fillStyle = burnt ? '#4a1f14' : PALETTE.sauce;
      context.beginPath();
      context.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
      context.fill();
    }
    if (pizza.toppings.includes('keju')) {
      // Cheese melts: the blobs slowly spread and wobble.
      const wobble = 1 + 0.04 * Math.sin(elapsed * 2.4 + cx);
      context.fillStyle = burnt ? '#6b5a2a' : PALETTE.cheese;
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2 + 0.5;
        const dist = r * 0.42;
        context.beginPath();
        context.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, r * 0.3 * wobble, 0, Math.PI * 2);
        context.fill();
      }
      context.beginPath();
      context.arc(cx, cy, r * 0.34 * wobble, 0, Math.PI * 2);
      context.fill();
    }
    const rest = pizza.toppings.filter((id) => id !== 'saus' && id !== 'keju');
    for (let i = 0; i < rest.length; i += 1) {
      const angle = (i / Math.max(1, rest.length)) * Math.PI * 2 + 0.9;
      const dist = r * 0.5;
      drawToppingPiece(rest[i], cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, r * 0.2);
      const angle2 = angle + Math.PI / Math.max(1, rest.length);
      drawToppingPiece(rest[i], cx + Math.cos(angle2) * dist * 0.55, cy + Math.sin(angle2) * dist * 0.55, r * 0.17);
    }
  }

  function drawBoxedPizza(cx, cy, size) {
    context.fillStyle = '#f5efe0';
    roundRect(cx - size / 2, cy - size / 2, size, size, 6);
    context.fill();
    context.strokeStyle = '#c0392b';
    context.lineWidth = 3;
    roundRect(cx - size / 2 + 4, cy - size / 2 + 4, size - 8, size - 8, 4);
    context.stroke();
    context.fillStyle = '#c0392b';
    context.beginPath();
    context.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f5efe0';
    context.beginPath();
    context.arc(cx, cy, size * 0.1, 0, Math.PI * 2);
    context.fill();
  }

  function drawHeart(x, y, size, filled) {
    context.fillStyle = filled ? PALETTE.red : '#4a2c1a';
    context.beginPath();
    context.moveTo(x, y + size * 0.9);
    context.bezierCurveTo(x - size, y + size * 0.1, x - size * 0.5, y - size * 0.7, x, y - size * 0.1);
    context.bezierCurveTo(x + size * 0.5, y - size * 0.7, x + size, y + size * 0.1, x, y + size * 0.9);
    context.fill();
  }

  function drawFloor() {
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, 156);
    context.fillStyle = PALETTE.wallDark;
    for (let x = 0; x < FIELD.width; x += 64) {
      context.fillRect(x, 148, 64, 8);
    }
    // Checkered kitchen tiles.
    for (let y = 156; y < FIELD.height; y += 56) {
      for (let x = 0; x < FIELD.width; x += 56) {
        const dark = ((x / 56 + y / 56) % 2) === 0;
        context.fillStyle = dark ? PALETTE.floorDark : PALETTE.floor;
        context.fillRect(x, y, 56, 56);
      }
    }
    context.fillStyle = PALETTE.tile;
    context.fillRect(0, 156, FIELD.width, 4);
  }

  function drawStationLabel(station, highlight) {
    // A dark pill behind the label keeps it readable over brick, fire or awning;
    // the serving window's label sits above its awning, not on it.
    const labelY = station.kind === 'serve' ? station.y - 34 : station.y - 8;
    context.font = `700 15px ${FONT}`;
    const width = context.measureText(station.label).width + 20;
    context.fillStyle = 'rgba(43,26,18,0.92)';
    roundRect(station.x + station.w / 2 - width / 2, labelY - 17, width, 22, 8);
    context.fill();
    text(station.label, station.x + station.w / 2, labelY, 15, highlight ? PALETTE.gold : PALETTE.text, 'center', true);
    text(station.sub, station.x + station.w / 2, station.y + station.h + 18, 13, '#2b1a12', 'center');
  }

  function drawField(state, nearStation) {
    drawFloor();
    const elapsed = state.elapsed;

    // Topping bins on the left wall.
    for (const bin of BINS) {
      const info = TOPPING_INFO[bin.topping];
      const hot = nearStation === bin;
      context.fillStyle = hot ? '#3d2417' : '#241610';
      roundRect(bin.x, bin.y, bin.w, bin.h, 10);
      context.fill();
      if (hot) {
        context.strokeStyle = PALETTE.gold;
        context.lineWidth = 3;
        roundRect(bin.x, bin.y, bin.w, bin.h, 10);
        context.stroke();
      }
      drawToppingPiece(bin.topping, bin.x + bin.w / 2, bin.y + bin.h / 2 - 8, 20);
      text(info.name, bin.x + bin.w / 2, bin.y + bin.h - 10, 14, PALETTE.text, 'center', true);
    }

    // Dough bench: a wooden table with flour dust.
    const dough = STATIONS.dough;
    const doughHot = nearStation === dough;
    context.fillStyle = '#8a5a33';
    roundRect(dough.x, dough.y, dough.w, dough.h, 10);
    context.fill();
    context.fillStyle = '#a9743f';
    roundRect(dough.x + 6, dough.y + 6, dough.w - 12, dough.h - 12, 8);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 6; i += 1) {
      context.beginPath();
      context.arc(dough.x + 24 + i * 28, dough.y + 16 + (i % 2) * 10, 3, 0, Math.PI * 2);
      context.fill();
    }
    if (doughHot) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      roundRect(dough.x, dough.y, dough.w, dough.h, 10);
      context.stroke();
    }
    drawStationLabel(dough, doughHot);

    // Wood-fired oven: brick dome, glowing mouth, two slots, flickering flames.
    const oven = STATIONS.oven;
    const ovenHot = nearStation === oven;
    context.fillStyle = '#8e3b22';
    context.beginPath();
    context.moveTo(oven.x, oven.y + oven.h);
    context.lineTo(oven.x, oven.y + 56);
    context.arc(oven.x + oven.w / 2, oven.y + 56, oven.w / 2, Math.PI, 0);
    context.lineTo(oven.x + oven.w, oven.y + oven.h);
    context.closePath();
    context.fill();
    context.fillStyle = '#6e2c18';
    context.beginPath();
    context.arc(oven.x + oven.w / 2, oven.y + 56, oven.w / 2 - 14, Math.PI, 0);
    context.fill();
    const glow = context.createRadialGradient(
      oven.x + oven.w / 2, oven.y + 128, 8,
      oven.x + oven.w / 2, oven.y + 128, 90,
    );
    glow.addColorStop(0, 'rgba(255,157,46,0.9)');
    glow.addColorStop(1, 'rgba(255,157,46,0)');
    context.fillStyle = glow;
    context.fillRect(oven.x, oven.y + 40, oven.w, oven.h - 40);
    // Flames licking the mouth of the oven.
    for (let i = 0; i < 3; i += 1) {
      const fx = oven.x + 52 + i * 46;
      const height = 26 + 10 * Math.sin(elapsed * 7 + i * 2.1);
      context.fillStyle = i === 1 ? '#ffd23e' : '#ff7a1a';
      context.beginPath();
      context.moveTo(fx - 13, oven.y + oven.h - 8);
      context.quadraticCurveTo(fx, oven.y + oven.h - 8 - height, fx + 13, oven.y + oven.h - 8);
      context.closePath();
      context.fill();
    }
    // Steam curling off the dome.
    for (let i = 0; i < 3; i += 1) {
      const rise = ((elapsed * 0.25 + i / 3) % 1);
      context.fillStyle = `rgba(255,255,255,${0.25 * (1 - rise)})`;
      context.beginPath();
      context.arc(oven.x + oven.w / 2 + Math.sin(rise * 6 + i) * 12, oven.y + 10 - rise * 46, 6 + rise * 6, 0, Math.PI * 2);
      context.fill();
    }
    for (let s = 0; s < OVEN.slots; s += 1) {
      const slot = state.ovenSlots[s];
      const sx = oven.x + 52 + s * 92;
      const sy = oven.y + 118;
      context.fillStyle = '#1d0f08';
      context.beginPath();
      context.arc(sx, sy, 32, 0, Math.PI * 2);
      context.fill();
      if (slot.pizza !== null) {
        drawPizza(sx, sy, 26, slot.pizza, elapsed);
        const progress = Math.min(1, slot.bakeT / OVEN.okMax);
        const perfect = slot.bakeT >= OVEN.perfectMin && slot.bakeT <= OVEN.perfectMax;
        const burnt = slot.bakeT > OVEN.okMax;
        context.fillStyle = '#1d0f08';
        roundRect(sx - 30, sy - 46, 60, 8, 4);
        context.fill();
        context.fillStyle = burnt ? PALETTE.red : perfect ? PALETTE.gold : PALETTE.green;
        roundRect(sx - 30, sy - 46, 60 * progress, 8, 4);
        context.fill();
        if (perfect) text('Siap!', sx, sy - 50, 13, PALETTE.gold, 'center', true);
        else if (burnt) text('Gosong!', sx, sy - 50, 13, PALETTE.red, 'center', true);
      }
    }
    if (ovenHot) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      roundRect(oven.x, oven.y, oven.w, oven.h, 10);
      context.stroke();
    }
    drawStationLabel(oven, ovenHot);

    // Boxing table: a stack of pizza boxes and a cutter wheel.
    const box = STATIONS.box;
    const boxHot = nearStation === box;
    context.fillStyle = '#8a5a33';
    roundRect(box.x, box.y, box.w, box.h, 10);
    context.fill();
    context.fillStyle = '#f5efe0';
    roundRect(box.x + 16, box.y + 14, 52, 44, 4);
    context.fill();
    context.fillStyle = '#f5efe0';
    roundRect(box.x + 26, box.y + 8, 52, 44, 4);
    context.fill();
    context.strokeStyle = '#c0392b';
    context.lineWidth = 2;
    roundRect(box.x + 30, box.y + 12, 44, 36, 3);
    context.stroke();
    context.fillStyle = '#c0c0c0';
    context.beginPath();
    context.arc(box.x + 150, box.y + 38, 20, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#8a8a8a';
    context.beginPath();
    context.arc(box.x + 150, box.y + 38, 6, 0, Math.PI * 2);
    context.fill();
    if (boxHot) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      roundRect(box.x, box.y, box.w, box.h, 10);
      context.stroke();
    }
    drawStationLabel(box, boxHot);

    // Serving window: red-and-white awning, dark counter.
    const serve = STATIONS.serve;
    const serveHot = nearStation === serve;
    for (let i = 0; i < 8; i += 1) {
      context.fillStyle = i % 2 === 0 ? '#c0392b' : '#fdf6e3';
      context.fillRect(serve.x + i * 32, serve.y - 26, 32, 26);
    }
    context.fillStyle = '#5e2c1c';
    roundRect(serve.x, serve.y, serve.w, serve.h, 8);
    context.fill();
    context.fillStyle = '#7a3b26';
    roundRect(serve.x + 8, serve.y + 8, serve.w - 16, serve.h - 16, 6);
    context.fill();
    if (serveHot) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      roundRect(serve.x, serve.y, serve.w, serve.h, 8);
      context.stroke();
    }
    drawStationLabel(serve, serveHot);

    // Trash bin.
    const trash = STATIONS.trash;
    const trashHot = nearStation === trash;
    context.fillStyle = '#5a5f6a';
    roundRect(trash.x, trash.y, trash.w, trash.h, 8);
    context.fill();
    context.fillStyle = '#7a7f8a';
    roundRect(trash.x + 8, trash.y + 6, trash.w - 16, 12, 4);
    context.fill();
    if (trashHot) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      roundRect(trash.x, trash.y, trash.w, trash.h, 8);
      context.stroke();
    }
    drawStationLabel(trash, trashHot);
  }

  function drawOrders(state) {
    const boardY = 62;
    const cardW = 270;
    const cardH = 82;
    const gap = 8;
    text('PESANAN', 24, boardY + 24, 22, PALETTE.gold, 'left', true);
    for (let i = 0; i < state.orders.length; i += 1) {
      const order = state.orders[i];
      const x = 140 + i * (cardW + gap);
      const y = boardY;
      const fraction = Math.max(0, order.patience / order.maxPatience);
      context.fillStyle = PALETTE.panel;
      roundRect(x, y, cardW, cardH, 10);
      context.fill();
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      roundRect(x, y, cardW, cardH, 10);
      context.stroke();
      text(order.recipe.name, x + 14, y + 26, 20, PALETTE.text, 'left', true);
      text(`${order.recipe.price} koin`, x + cardW - 14, y + 26, 18, PALETTE.gold, 'right', true);
      let dotX = x + 16;
      for (const topping of order.recipe.toppings) {
        drawToppingPiece(topping, dotX, y + 52, 10);
        dotX += 26;
      }
      context.fillStyle = '#1d0f08';
      roundRect(x + 14, y + cardH - 14, cardW - 28, 7, 3);
      context.fill();
      context.fillStyle = fraction > 0.5 ? PALETTE.green : fraction > 0.25 ? PALETTE.gold : PALETTE.red;
      roundRect(x + 14, y + cardH - 14, (cardW - 28) * fraction, 7, 3);
      context.fill();
    }
  }

  function drawHud(state) {
    context.fillStyle = PALETTE.panel;
    context.fillRect(0, 0, FIELD.width, 56);
    text('PIZZA KILAT', 24, 36, 26, PALETTE.gold, 'left', true);
    text(formatTime(state.timeLeft), FIELD.width / 2, 38, 30, PALETTE.text, 'center', true);
    const timeFraction = Math.max(0, state.timeLeft / SHIFT_SECONDS);
    context.fillStyle = '#1d0f08';
    context.fillRect(FIELD.width / 2 - 110, 48, 220, 5);
    context.fillStyle = timeFraction > 0.5 ? PALETTE.green : timeFraction > 0.25 ? PALETTE.gold : PALETTE.red;
    context.fillRect(FIELD.width / 2 - 110, 48, 220 * timeFraction, 5);
    let heartX = 872;
    for (let heart = 0; heart < HEARTS; heart += 1) {
      drawHeart(heartX, 30, 11, heart < state.hearts);
      heartX += 28;
    }
    text(coinsLabel(state.coins), 1010, 36, 24, PALETTE.gold, 'left', true);
    if (state.combo > 1) text(comboLabel(state.combo), 1260, 36, 24, '#ff9d2e', 'right', true);
  }

  function drawChef(state) {
    const chef = state.chef;
    const elapsed = state.elapsed;
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(chef.x, chef.y + 18, 22, 8, 0, 0, Math.PI * 2);
    context.fill();
    // Body: shirt and apron.
    context.fillStyle = PALETTE.chefShirt;
    context.beginPath();
    context.arc(chef.x, chef.y, 20, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.chefApron;
    context.beginPath();
    context.arc(chef.x, chef.y + 4, 16, 0, Math.PI);
    context.fill();
    context.fillRect(chef.x - 16, chef.y + 4, 32, 12);
    // Head and puffy chef hat.
    context.fillStyle = '#f2c89b';
    context.beginPath();
    context.arc(chef.x, chef.y - 20, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.chefHat;
    context.beginPath();
    context.arc(chef.x - 9, chef.y - 30, 8, 0, Math.PI * 2);
    context.arc(chef.x, chef.y - 34, 9, 0, Math.PI * 2);
    context.arc(chef.x + 9, chef.y - 30, 8, 0, Math.PI * 2);
    context.fill();
    context.fillRect(chef.x - 12, chef.y - 32, 24, 6);
    // Eyes look the way the chef faces.
    context.fillStyle = '#241610';
    context.beginPath();
    context.arc(chef.x + chef.face * 4 - 4, chef.y - 21, 1.8, 0, Math.PI * 2);
    context.arc(chef.x + chef.face * 4 + 4, chef.y - 21, 1.8, 0, Math.PI * 2);
    context.fill();
    // The carried pizza rides above the chef's head.
    if (state.carried !== null) {
      const bob = Math.sin(elapsed * 3) * 2;
      const py = chef.y - 62 + bob;
      if (state.carried.boxed) drawBoxedPizza(chef.x, py, 44);
      else drawPizza(chef.x, py, 24, state.carried, elapsed);
    }
    // Channel progress ring while stretching dough or boxing.
    if (state.channel !== null) {
      const fraction = state.channel.t / state.channel.duration;
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 5;
      context.beginPath();
      context.arc(chef.x, chef.y, 30, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
      context.stroke();
    }
  }

  function drawMessage(state) {
    if (state.message === null || state.elapsed > state.messageUntil) return;
    context.font = `700 26px ${FONT}`;
    context.textAlign = 'center';
    context.fillStyle = 'rgba(0,0,0,0.55)';
    const width = context.measureText(state.message).width + 36;
    roundRect(FIELD.width / 2 - width / 2, 512, width, 44, 10);
    context.fill();
    context.fillStyle = PALETTE.gold;
    context.fillText(state.message, FIELD.width / 2, 542);
  }

  function drawBanner(best) {
    context.fillStyle = 'rgba(43,26,18,0.94)';
    roundRect(BANNER.x, BANNER.y, BANNER.w, BANNER.h, 14);
    context.fill();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 3;
    roundRect(BANNER.x, BANNER.y, BANNER.w, BANNER.h, 14);
    context.stroke();
    text('PIZZA KILAT', FIELD.width / 2, BANNER.y + 52, 46, PALETTE.gold, 'center', true);
    text('Uleni, beri topping, panggang di oven kayu, antar sebelum dingin!', FIELD.width / 2, BANNER.y + 84, 19, PALETTE.text, 'center');
    text('Gerak: WASD / panah / klik.  Gunakan: E.  Jeda: P.', FIELD.width / 2, BANNER.y + 108, 17, PALETTE.muted, 'center');
    context.textBaseline = 'alphabetic';
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, PANEL.width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(x, y, PANEL.width, height, 14);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.gold, 'center', true);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.gold, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, nearStation) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state, nearStation);
    drawOrders(state);
    drawChef(state);
    if (screen === SCREEN_TITLE) {
      drawHud(state);
      drawBanner(best);
      return;
    }
    drawHud(state);
    drawMessage(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Jeda', ['Ovennya menunggu.'], 'Tekan P untuk lanjut');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Shift Selesai!', [finalLabel(state.coins), servedLabel(state.served), bestLabel(best)], 'Tekan Spasi atau klik untuk main lagi');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
