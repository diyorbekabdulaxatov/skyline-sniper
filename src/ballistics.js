// @ts-check
// Ballistics and hit geometry. Pure functions without three.js, so Node can unit-test them.
// Units are metres, seconds and radians. World axes: x right, y up, z toward the shooter,
// so downrange is -z.

export const GRAVITY = 9.81;
export const SOUND_SPEED = 343;

/**
 * Rifles. drag is the quadratic drag factor per metre: speed falls as v0 * exp(-drag * distance).
 * @typedef {{ id: string, name: string, velocity: number, drag: number, magazine: number,
 *   boltTime: number, reloadTime: number, swayMul: number, zero: number, sightHeight: number }} Rifle
 */

/** @type {Rifle} */
export const KESTREL = {
  id: 'kestrel',
  name: 'Kestrel .308',
  velocity: 780,
  drag: 0.0005,
  magazine: 5,
  boltTime: 1.0,
  reloadTime: 2.2,
  swayMul: 1.0,
  zero: 100,
  sightHeight: 0.05
};

/**
 * Bullet state, mutated in place by step().
 * @typedef {{ x: number, y: number, z: number, vx: number, vy: number, vz: number, t: number, drag: number }} Bullet
 */

/**
 * Advances a bullet by dt seconds: gravity, plus quadratic drag against the moving air.
 * @param {Bullet} b
 * @param {number} dt
 * @param {{ x: number, z: number }} wind air velocity in m/s
 */
export function step(b, dt, wind) {
  const rx = b.vx - wind.x;
  const ry = b.vy;
  const rz = b.vz - wind.z;
  const k = b.drag * Math.sqrt(rx * rx + ry * ry + rz * rz);
  b.vx -= k * rx * dt;
  b.vy -= (k * ry + GRAVITY) * dt;
  b.vz -= k * rz * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.t += dt;
}

/**
 * Flies a shot straight downrange (along -z) from the line of sight and reports where it is at
 * `range` metres: drop below the line of sight (positive = low), drift with the wind and time.
 * The bore sits `sightHeight` below the sight and is tilted up by `angle`.
 * @param {Rifle} rifle
 * @param {number} angle bore elevation above the line of sight, radians
 * @param {number} range metres downrange
 * @param {number} crossWind m/s, positive blows to the right (+x)
 */
export function shotAt(rifle, angle, range, crossWind) {
  /** @type {Bullet} */
  const b = {
    x: 0, y: -rifle.sightHeight, z: 0,
    vx: 0, vy: rifle.velocity * Math.sin(angle), vz: -rifle.velocity * Math.cos(angle),
    t: 0, drag: rifle.drag
  };
  const wind = { x: crossWind, z: 0 };
  const dt = 1 / 2000;
  let prev = { x: b.x, y: b.y, z: b.z, t: b.t };
  while (-b.z < range && b.t < 10) {
    prev = { x: b.x, y: b.y, z: b.z, t: b.t };
    step(b, dt, wind);
  }
  const f = (range + prev.z) / (prev.z - b.z || 1);
  return {
    drop: -(prev.y + (b.y - prev.y) * f),
    drift: prev.x + (b.x - prev.x) * f,
    time: prev.t + (b.t - prev.t) * f
  };
}

/**
 * Bore elevation that puts the bullet back on the line of sight at the rifle's zero range.
 * @param {Rifle} rifle
 */
export function zeroAngle(rifle) {
  let lo = 0;
  let hi = 0.02;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (shotAt(rifle, mid, rifle.zero, 0).drop > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------- Body geometry ----------
// The same proportions as the 2D game's LW.bodyGeom: feet at y = 0, head circle centred at
// 0.935 h with radius 0.066 h, torso 0.30 h wide from 0.45 h to 0.86 h, legs 0.22 h wide.
// Every person and paper target is drawn inside these shapes so hits match what players see.

export const BODY = {
  HEIGHT: 1.8,
  HEAD_Y: 0.935,
  HEAD_R: 0.066,
  TORSO_HALF_W: 0.15,
  TORSO_Y0: 0.45,
  TORSO_Y1: 0.86,
  LEGS_HALF_W: 0.11,
  DEPTH_HALF: 0.07,
  HEAD_LENIENCY: 1.3
};

/**
 * Hit test on a flat silhouette in its own plane. x is sideways from the centre line and
 * y is height above the feet, both in metres.
 * @param {number} x
 * @param {number} y
 * @param {number} h person height
 * @param {number} leniency head radius multiplier
 * @returns {'head' | 'body' | null}
 */
export function silhouetteHit(x, y, h, leniency) {
  const r = BODY.HEAD_R * h * leniency;
  const dy = y - BODY.HEAD_Y * h;
  if (x * x + dy * dy <= r * r) return 'head';
  if (Math.abs(x) <= BODY.TORSO_HALF_W * h && y >= BODY.TORSO_Y0 * h && y <= BODY.TORSO_Y1 * h) return 'body';
  if (Math.abs(x) <= BODY.LEGS_HALF_W * h && y >= 0 && y < BODY.TORSO_Y0 * h) return 'body';
  return null;
}

/**
 * Where a segment from a to b first meets a solid person standing at the origin of its local
 * frame (feet at y = 0, facing +z). Returns the fraction along the segment and the part hit.
 * @param {{x:number,y:number,z:number}} a
 * @param {{x:number,y:number,z:number}} b
 * @param {number} h
 * @returns {{ t: number, part: 'head' | 'body' } | null}
 */
export function personHit(a, b, h) {
  /** @type {{ t: number, part: 'head' | 'body' } | null} */
  let best = null;
  const hy = BODY.HEAD_Y * h;
  const ts = segmentSphere(a, b, 0, hy, 0, BODY.HEAD_R * h);
  if (ts !== null) best = { t: ts, part: 'head' };
  const d = BODY.DEPTH_HALF * h * 1.6;
  const boxes = [
    [-BODY.TORSO_HALF_W * h, BODY.TORSO_Y0 * h, -d, BODY.TORSO_HALF_W * h, BODY.TORSO_Y1 * h, d],
    [-BODY.LEGS_HALF_W * h, 0, -d * 0.8, BODY.LEGS_HALF_W * h, BODY.TORSO_Y0 * h, d * 0.8]
  ];
  for (const box of boxes) {
    const tb = segmentBox(a, b, box);
    if (tb !== null && (!best || tb < best.t)) best = { t: tb, part: 'body' };
  }
  return best;
}

/**
 * First fraction (0..1) where segment a-b enters a sphere, or null.
 * @param {{x:number,y:number,z:number}} a
 * @param {{x:number,y:number,z:number}} b
 * @param {number} cx @param {number} cy @param {number} cz @param {number} r
 */
export function segmentSphere(a, b, cx, cy, cz, r) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const fx = a.x - cx, fy = a.y - cy, fz = a.z - cz;
  const A = dx * dx + dy * dy + dz * dz;
  const B = 2 * (fx * dx + fy * dy + fz * dz);
  const C = fx * fx + fy * fy + fz * fz - r * r;
  if (A === 0) return C <= 0 ? 0 : null;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-B - s) / (2 * A);
  const t1 = (-B + s) / (2 * A);
  if (t0 >= 0 && t0 <= 1) return t0;
  if (t0 < 0 && t1 >= 0) return 0;
  return null;
}

/**
 * First fraction (0..1) where segment a-b enters an axis-aligned box, or null.
 * @param {{x:number,y:number,z:number}} a
 * @param {{x:number,y:number,z:number}} b
 * @param {number[]} box [minX, minY, minZ, maxX, maxY, maxZ]
 */
export function segmentBox(a, b, box) {
  let t0 = 0;
  let t1 = 1;
  const p = [a.x, a.y, a.z];
  const d = [b.x - a.x, b.y - a.y, b.z - a.z];
  for (let i = 0; i < 3; i++) {
    const lo = box[i];
    const hi = box[i + 3];
    if (Math.abs(d[i]) < 1e-12) {
      if (p[i] < lo || p[i] > hi) return null;
    } else {
      let ta = (lo - p[i]) / d[i];
      let tb = (hi - p[i]) / d[i];
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return null;
    }
  }
  return t0;
}
