// Every tuning number, colour and recipe in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One shift lasts this long, in seconds. */
export const SHIFT_SECONDS = 150;

export const CHEF = {
  radius: 20,
  speed: 300,
  carryHeight: 34,
};

export const HEARTS = 3;

/** How far, in pixels, the chef must be from a station's edge to use it. */
export const USE_RANGE = 60;

/** Seconds a pizza must bake, and the windows that decide its quality. */
export const OVEN = {
  slots: 2,
  perfectMin: 5,
  perfectMax: 7,
  okMax: 9,
};

/** Seconds the boxing table takes to slice and box one pizza. */
export const BOX_SECONDS = 0.6;

/** Seconds a dough takes to stretch at the dough bench. */
export const DOUGH_SECONDS = 0.6;

/** Orders: how often one arrives, and how long it waits, as the shift wears on. */
export const ORDERS = {
  maxOpen: 4,
  firstAfter: 6,
  intervalStart: 16,
  intervalEnd: 9,
  patienceStart: 55,
  patienceEnd: 32,
};

/** Serving one pizza within this many seconds of the last keeps the combo going. */
export const COMBO_WINDOW = 20;

/** Topping ids, in the order their bins sit on the wall. */
export const TOPPINGS = ['saus', 'keju', 'pepperoni', 'jamur', 'paprika', 'zaitun'];

export const TOPPING_INFO = {
  saus: { name: 'Saus', color: '#d94f30', dark: '#a83a20' },
  keju: { name: 'Keju', color: '#f2c94c', dark: '#d9a521' },
  pepperoni: { name: 'Pepperoni', color: '#c0392b', dark: '#8e2a20' },
  jamur: { name: 'Jamur', color: '#e8dcc8', dark: '#b8a888' },
  paprika: { name: 'Paprika', color: '#7cb342', dark: '#558b2f' },
  zaitun: { name: 'Zaitun', color: '#4a6741', dark: '#33482c' },
};

/** Every recipe: the topping set it needs (order does not matter) and its price. */
export const RECIPES = [
  { name: 'Margherita', toppings: ['saus', 'keju'], price: 12 },
  { name: 'Pepperoni', toppings: ['saus', 'keju', 'pepperoni'], price: 16 },
  { name: 'Funghi', toppings: ['saus', 'keju', 'jamur'], price: 15 },
  { name: 'Paprika Manis', toppings: ['saus', 'keju', 'paprika', 'zaitun'], price: 18 },
  { name: 'Diavola', toppings: ['saus', 'keju', 'pepperoni', 'paprika'], price: 20 },
  { name: 'Supreme', toppings: ['saus', 'keju', 'pepperoni', 'jamur', 'paprika', 'zaitun'], price: 26 },
];

/** Where each station sits, in playfield pixels. */
export const STATIONS = {
  dough: { kind: 'dough', label: 'MEJA ADONAN', sub: 'uleni adonan', x: 430, y: 168, w: 190, h: 74 },
  oven: { kind: 'oven', label: 'OVEN KAYU', sub: 'api kayu', x: 1060, y: 168, w: 196, h: 168 },
  box: { kind: 'box', label: 'MEJA KOTAK', sub: 'iris & kemas', x: 500, y: 612, w: 220, h: 76 },
  serve: { kind: 'serve', label: 'JENDELA ANTAR', sub: 'antar pizza jadi', x: 1000, y: 560, w: 256, h: 128 },
  trash: { kind: 'trash', label: 'TONG SAMPAH', sub: 'buang pizza', x: 240, y: 612, w: 140, h: 76 },
};

/** Topping bins in one column down the left wall, spaced so the chef can reach each. */
export const BINS = TOPPINGS.map((id, i) => ({
  kind: 'bin',
  topping: id,
  x: 24,
  y: 168 + i * 88,
  w: 88,
  h: 88,
}));

export const PALETTE = {
  backdrop: '#17100c',
  wall: '#7a3b26',
  wallDark: '#5e2c1c',
  floor: '#c89b6a',
  floorDark: '#b9854f',
  tile: '#e8d3a8',
  panel: '#2b1a12',
  panelEdge: '#4a2c1a',
  text: '#fff3e0',
  muted: '#d8b48f',
  gold: '#f2c94c',
  red: '#d94f30',
  green: '#7cb342',
  cream: '#fdf6e3',
  ovenGlow: '#ff9d2e',
  crust: '#e8a94f',
  crustDark: '#b97c2e',
  sauce: '#c0392b',
  cheese: '#f7d774',
  chefHat: '#fdf6e3',
  chefShirt: '#e8e0d0',
  chefApron: '#c0392b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'pizza-kilat.best';
