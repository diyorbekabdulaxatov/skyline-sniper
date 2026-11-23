// @ts-check
// Contract 06, Rooftop Pool: the layout as plain numbers, without three.js, so Node can check the
// lines of fire (see the comments in pool.js). South-west of the city: the Cassian hotel tower
// (x -318..-274, z 60..98) with its pool deck at y = 56.15, and the shooter on a taller glass
// tower (roof y = 96) about 230 m to the south-east. Axes: x east, y up, z south; metres.

const DECK_Y = 56.15;

export const POOL = {
  eye: { x: -160, y: 97.7, z: 262 },
  /** The shooter's tower and its parapet. */
  shooter: { x0: -162, x1: -136, z0: 260.8, z1: 286.8, roof: 96, parapet: 0.85 },
  /** The hotel's box (its roof is under the deck slabs) and the deck surface. */
  hotel: { x0: -318, x1: -274, z0: 60, z1: 98, top: 55 },
  deckY: DECK_Y,
  /** The pool: water surface, floor and the steps at the east end (a ramp for walking). */
  water: { x0: -306, x1: -284, z0: 71.5, z1: 81.5, y: 56.0, floor: 55.05, stepX: -286.5 },
  /** Lift and stair house in the north-west corner (the way out), door on its east face. */
  lift: { x0: -318, x1: -306, z0: 60, z1: 69.5, h: 4.0 },
  door: { x: -305.3, z: 64.8 },
  /** Service stair hut in the north-east corner (where the staff and guests flee). */
  service: { x0: -279, x1: -274, z0: 60, z1: 63.6, h: 3.0 },
  serviceDoor: { x: -276.6, z: 64.3 },
  /** Bar counter along the north side, back bar against the railing. */
  bar: { x0: -300, x1: -288, z0: 62.6, z1: 63.6, h: 1.12 },
  backBar: { x0: -300, x1: -288, z0: 60.5, z1: 61.1, h: 2.2 },
  /** Lifeguard chair at the pool's south-west corner, platform height. */
  lifeguard: { x: -307.6, z: 84.6, h: 1.45 },
  /** Loungers on the south sun deck (long axis along z, backrest to the south). */
  loungers: [-314.5, -311.5, -305.5, -302.5, -296.5, -293.5, -289.5].map((x) => ({ x, z: 88.6, rot: 0 }))
    .concat([{ x: -313, z: 73.6, rot: Math.PI / 2 }, { x: -313, z: 77.4, rot: Math.PI / 2 }]),
  umbrellas: [{ x: -313, z: 88.6 }, { x: -304, z: 88.6 }, { x: -295, z: 88.6 }, { x: -313.4, z: 75.5 }],
  /** Planters along the railings (kept off the target's lines of fire). */
  plants: [[-275.4, 67], [-275.4, 73], [-275.4, 79], [-275.4, 94], [-316.8, 72], [-316.8, 80], [-316.8, 92],
    [-312, 97], [-304, 97], [-298, 97], [-292, 97], [-303.6, 61.2], [-284.4, 61.2], [-306.8, 70.4]],
  /** Lounge sofas in the east aisle. */
  lounge: { x: -279.2, z: 88.2, rot: -Math.PI / 2 }
};

/** Where the target stands for each shot window. */
export const SPOTS = {
  start: { x: -296.8, z: 91.2 },
  phone: { x: -283.6, z: 96.6 },
  wade: { x: -289.5, z: 76.5 },
  bar: { x: -292.5, z: 64.35 }
};

const towardEye = (p) => Math.atan2(POOL.eye.x - p.x, POOL.eye.z - p.z);

/**
 * The target's afternoon (walking speed 1.1 m/s): talk at his lounger, a phone call at the south
 * railing facing the city (about 21-45 s), a wade in the shallow end (about 69-84 s), a drink at
 * the bar (about 106-126 s), then the lift door (about 138 s). `face` turns him while he waits.
 */
export const ROUTE = [
  { x: SPOTS.start.x, z: SPOTS.start.z, wait: 9, anim: 'talk', face: Math.atan2(1.2, 0.4) },
  { x: -287.5, z: 94.5 },
  { x: SPOTS.phone.x, z: SPOTS.phone.z, wait: 24, anim: 'phone', face: towardEye(SPOTS.phone) },
  { x: -283.0, z: 86.0 },
  { x: -283.4, z: 76.5 },
  { x: SPOTS.wade.x, z: SPOTS.wade.z, wait: 15, anim: 'idle', face: -Math.PI / 2 },
  { x: -283.4, z: 76.5 },
  { x: -283.4, z: 68.0 },
  { x: SPOTS.bar.x, z: SPOTS.bar.z, wait: 20, anim: 'talk', face: Math.PI },
  { x: -303.2, z: 66.0 },
  { x: POOL.door.x, z: POOL.door.z }
];
export const ROUTE_SPEED = 1.1;

/** Ground height under (x, z) on the deck: the pool floor in the water, a ramp on the steps. */
export function groundAt(x, z) {
  const w = POOL.water;
  if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) return DECK_Y;
  if (x >= w.stepX) return DECK_Y + ((w.floor - DECK_Y) * (w.x1 - x)) / (w.x1 - w.stepX);
  return w.floor;
}

/** True when (x, z) is in the pool. */
export function inPool(x, z) {
  const w = POOL.water;
  return x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1;
}

/**
 * Procedural buildings around the hotel: x, z, width, depth, height, facade style. All stay well
 * under the lines of fire (the line is at least 57 m high anywhere between the towers).
 * @type {[number, number, number, number, number, string][]}
 */
export const BLOCKS = [
  [-330, 80, 14, 48, 22, 'brick'],
  [-180, 70, 40, 44, 38, 'glassGreen'],
  [-318, 148, 36, 50, 26, 'brick'],
  [-276, 142, 26, 30, 34, 'office'],
  [-224, 150, 34, 44, 30, 'stone'],
  [-174, 146, 36, 40, 44, 'concrete'],
  [-300, 222, 60, 50, 20, 'office'],
  [-214, 226, 42, 40, 28, 'brick']
];

const E = Math.PI / 2;
/**
 * Guests and staff who stay in one place: x, z, facing (radians, 0 = south), clip, woman?
 * Swimmers stand in the shallow water. The lifeguard stands on his chair.
 * @type {{ x: number, z: number, face: number, role: string, female?: boolean, kind?: string }[]}
 */
export const GUESTS = [
  { x: -295.6, z: 91.6, face: Math.atan2(-1.2, -0.4), role: 'talk', female: true, kind: 'companion' },
  { x: -311.6, z: 91.4, face: E, role: 'talk' },
  { x: -310.4, z: 91.9, face: -E, role: 'idle', female: true },
  { x: -303.6, z: 91.0, face: E, role: 'talk' },
  { x: -302.3, z: 91.5, face: -E, role: 'idle2', female: true },
  { x: -290.2, z: 92.6, face: 0, role: 'phone' },
  { x: -311.4, z: 80.8, face: E, role: 'idle2' },
  { x: -297.6, z: 64.3, face: E, role: 'talk' },
  { x: -296.4, z: 64.25, face: -E, role: 'idle', female: true },
  { x: -288.6, z: 64.35, face: Math.PI, role: 'idle' },
  { x: -277.6, z: 84.4, face: -2.0, role: 'talk' },
  { x: -278.8, z: 83.9, face: 1.15, role: 'idle', female: true },
  { x: -300.5, z: 75.2, face: E, role: 'talk', kind: 'swimmer' },
  { x: -299.3, z: 75.8, face: -2.0, role: 'idle', female: true, kind: 'swimmer' },
  { x: -302.5, z: 79.4, face: 0.4, role: 'idle2', kind: 'swimmer' },
  { x: -292.0, z: 61.9, face: 0, role: 'idle', kind: 'staff' },
  { x: -297.5, z: 61.9, face: 0, role: 'idle2', kind: 'staff' },
  { x: POOL.lifeguard.x, z: POOL.lifeguard.z, face: 2.14, role: 'idle', kind: 'lifeguard' }
];

/** Waiters loop between the bar and the loungers; one swimmer wades up and down the pool. */
export const WALKERS = [
  [{ x: -290, z: 65.4, wait: 4 }, { x: -283.2, z: 69.5 }, { x: -283.2, z: 85.6 }, { x: -292, z: 93.6 }, { x: -306, z: 93.6 },
    { x: -309.6, z: 86 }, { x: -309.6, z: 70.4 }, { x: -299, z: 66.8 }],
  [{ x: -299, z: 66.8, wait: 5 }, { x: -309.6, z: 70.4 }, { x: -309.6, z: 86 }, { x: -298, z: 94.2 }, { x: -286, z: 94.2 },
    { x: -283.2, z: 85.6 }, { x: -283.2, z: 69.5 }, { x: -290, z: 65.4 }],
  [{ x: -304.6, z: 78.4 }, { x: -293.4, z: 78.4, wait: 3 }]
];

/**
 * Neighbouring towers from the downtown_towers pack (Sketchfab), with a procedural stand-in
 * (width, depth, height, style) when the pack is missing. All of them stand beside or behind the
 * hotel as seen from the shooter.
 * @type {{ name: string, x: number, z: number, w: number, d: number, h: number, style: string }[]}
 */
export const NEIGHBOURS = [
  { name: 'Downtown_ModernOffice_5', x: -362, z: 130, w: 36, d: 36, h: 102, style: 'glassBlue' },
  { name: 'Downtown_ModernOffice_4', x: -334, z: 18, w: 39, d: 39, h: 81, style: 'glassGreen' },
  { name: 'Downtown_ArtDeco_1', x: -262, z: 22, w: 18, d: 31, h: 45, style: 'stone' },
  { name: 'Downtown_Residential_2', x: -225, z: 72, w: 32, d: 32, h: 30, style: 'concrete' },
  { name: 'Downtown_Residential_3', x: -365, z: 72, w: 37, d: 37, h: 28, style: 'concrete' }
];

/** Pavement blocks (sidewalk plinths) between the streets: x0, z0, x1, z1. */
export const PLINTHS = [
  [-338, 42, -258, 104], [-244, 42, -150, 104],
  [-338, 118, -258, 178], [-244, 118, -150, 178],
  [-338, 192, -258, 250], [-244, 192, -130, 300]
];

/**
 * Solid boxes for bullets [x0, y0, z0, x1, y1, z1]: the shooter's tower and parapet, the hotel,
 * its deck, curbs, huts, bar and lifeguard chair, and the procedural blocks. Glass railings,
 * loungers, umbrellas and plants let bullets through.
 */
export function poolColliders() {
  /** @type {number[][]} */
  const out = [];
  const S = POOL.shooter;
  const p = S.roof + S.parapet;
  out.push([S.x0, 0, S.z0, S.x1, S.roof, S.z1]);
  out.push([S.x0, S.roof, S.z0, S.x1, p, S.z0 + 0.4]);
  out.push([S.x0, S.roof, S.z1 - 0.4, S.x1, p, S.z1]);
  out.push([S.x0, S.roof, S.z0, S.x0 + 0.4, p, S.z1]);
  out.push([S.x1 - 0.4, S.roof, S.z0, S.x1, p, S.z1]);
  const H = POOL.hotel;
  const W = POOL.water;
  const y = DECK_Y;
  out.push([H.x0, 0, H.z0, H.x1, H.top, H.z1]);
  out.push([H.x0, H.top, H.z0, H.x1, y, W.z0]);
  out.push([H.x0, H.top, W.z1, H.x1, y, H.z1]);
  out.push([H.x0, H.top, W.z0, W.x0, y, W.z1]);
  out.push([W.x1, H.top, W.z0, H.x1, y, W.z1]);
  out.push([W.x0, H.top, W.z0, W.x1, W.floor, W.z1]);
  // Stone curbs under the glass railing.
  const c = y + 0.3;
  out.push([H.x0, y, H.z1 - 0.3, H.x1, c, H.z1]);
  out.push([H.x0, y, H.z0, H.x1, c, H.z0 + 0.3]);
  out.push([H.x0, y, H.z0, H.x0 + 0.3, c, H.z1]);
  out.push([H.x1 - 0.3, y, H.z0, H.x1, c, H.z1]);
  for (const b of [POOL.lift, POOL.service]) out.push([b.x0, y, b.z0, b.x1, y + b.h, b.z1]);
  for (const b of [POOL.bar, POOL.backBar]) out.push([b.x0, y, b.z0, b.x1, y + b.h, b.z1]);
  const L = POOL.lifeguard;
  out.push([L.x - 0.5, y + L.h - 0.1, L.z - 0.45, L.x + 0.5, y + L.h, L.z + 0.45]);
  for (const [x, z, w, d, h] of BLOCKS) out.push([x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2]);
  return out;
}
