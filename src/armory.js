// @ts-check
// Rifles, upgrades and gear for the store (the Armory). Everything is bought with cash earned by
// playing; there is no paid currency. Pure JS (no three.js) so Node can unit-test the rules.
import { KESTREL } from './ballistics.js';

/**
 * What makes a rifle special beyond its numbers. game.js applies these through setLoadout.
 * - suppressed: the shot itself does not alarm the crowd (a hit on a civilian still ends it).
 * - zoomBonus: extra maximum magnification on top of the Scope upgrade.
 * - breathBonus: extra seconds of held breath.
 * - semiAuto: no bolt to work (the short boltTime is the follow-up delay; no bolt sound).
 * - pierceCars: the bullet goes through car bodies instead of stopping in them.
 * @typedef {{ suppressed?: boolean, zoomBonus?: number, breathBonus?: number, semiAuto?: boolean,
 *   pierceCars?: boolean }} RifleTraits
 */

/**
 * `stats` override the base rifle in ballistics.js (KESTREL) for gameplay: muzzle velocity
 * (m/s), drag, magazine, bolt and reload times (s), sway multiplier. `model` is the Armory's
 * turning 3D model (falls back to the default rifle model when missing).
 * @typedef {{ id: string, name: string, calibre: string, description: string,
 *   trait: { name: string, text: string }, traits: RifleTraits, model: string,
 *   stats: Partial<import('./ballistics.js').Rifle>,
 *   unlock: { level: number, price: number } | null }} RifleDef
 * @typedef {{ id: 'scope' | 'stability' | 'breath' | 'bolt', name: string, description: string,
 *   values: number[], format: (v: number) => string, prices: number[] }} UpgradeDef
 * @typedef {'windmeter' | 'extmag' | 'brace' | 'computer'} GearId
 * @typedef {{ id: GearId, name: string, effect: string, price: number, level: number }} GearDef
 */

const MODEL_DIR = './game-assets/sketchfab/';

/** @type {RifleDef[]} */
export const RIFLES = [
  {
    id: 'harrier',
    name: 'Harrier .338',
    calibre: '.338 Magnum, bolt action',
    description: 'A long-range bolt rifle with a folding stock. Accurate, quick to cycle and steady to hold.',
    trait: { name: 'Balanced', text: '+1 s of held breath.' },
    traits: { breathBonus: 1 },
    model: MODEL_DIR + 'rifle_harrier.glb',
    stats: {},
    unlock: null
  },
  {
    id: 'kite',
    name: 'Kite 7.62',
    calibre: '7.62 mm, semi-automatic',
    description: 'A semi-automatic marksman rifle: ten rounds and a fast second shot, but a slower bullet that drops more and a lighter, shakier hold.',
    trait: { name: 'Semi-automatic', text: 'No bolt to work: fire again in 0.3 s.' },
    traits: { semiAuto: true },
    model: MODEL_DIR + 'rifle_kite.glb',
    stats: { velocity: 720, drag: 0.0006, magazine: 10, boltTime: 0.3, reloadTime: 2.6, swayMul: 1.25 },
    unlock: { level: 2, price: 2500 }
  },
  {
    id: 'wren',
    name: 'Wren .308 SD',
    calibre: '.308, suppressed bolt action',
    description: 'A short, integrally suppressed rifle. Subsonic-leaning loads fly slower and drop more, but nobody hears where the shot came from.',
    trait: { name: 'Suppressed', text: 'Your shots do not alarm the crowd.' },
    traits: { suppressed: true },
    model: MODEL_DIR + 'rifle_wren.glb',
    stats: { velocity: 680, drag: 0.00055, magazine: 5, boltTime: 1.05, reloadTime: 2.3, swayMul: 0.95 },
    unlock: { level: 3, price: 3500 }
  },
  {
    id: 'osprey',
    name: 'Osprey .50',
    calibre: '.50 BMG, bullpup',
    description: 'Anti-materiel rifle: a faster, flatter bullet that drops less and drifts less in the wind, for the longest shots. Heavier to hold steady and slower to cycle.',
    trait: { name: 'Anti-materiel', text: 'Shoots straight through car bodies.' },
    traits: { pierceCars: true },
    model: MODEL_DIR + 'rifle_osprey.glb',
    stats: { velocity: 900, drag: 0.00034, magazine: 5, boltTime: 1.35, reloadTime: 3.0, swayMul: 1.2 },
    unlock: { level: 5, price: 6000 }
  },
  {
    id: 'albatross',
    name: 'Albatross .408',
    calibre: '.408, long-range bolt action',
    description: 'A heavy long-range rifle: the fastest, flattest bullet in the store and a powerful scope. The heaviest to hold and the slowest to cycle.',
    trait: { name: 'Long-range optic', text: '+4× maximum zoom.' },
    traits: { zoomBonus: 4 },
    model: MODEL_DIR + 'rifle_albatross.glb',
    stats: { velocity: 960, drag: 0.00026, magazine: 5, boltTime: 1.6, reloadTime: 3.4, swayMul: 1.45 },
    unlock: { level: 7, price: 9000 }
  }
];

/** Five upgrade levels each; values[0] is the stock rifle. */
/** @type {UpgradeDef[]} */
export const UPGRADES = [
  {
    id: 'scope',
    name: 'Scope',
    description: 'Higher maximum magnification.',
    values: [12, 14, 16, 18, 20, 24],
    format: (v) => v + '×',
    prices: [300, 650, 1100, 1700, 2600]
  },
  {
    id: 'stability',
    name: 'Stability',
    description: 'Less sway through the scope.',
    values: [1, 0.88, 0.77, 0.67, 0.58, 0.5],
    format: (v) => Math.round((1 - v) * 100) + '% steadier',
    prices: [250, 550, 950, 1500, 2300]
  },
  {
    id: 'breath',
    name: 'Breath',
    description: 'Hold your breath for longer.',
    values: [5, 6, 7, 8, 9, 10],
    format: (v) => v + ' s',
    prices: [200, 450, 800, 1250, 1900]
  },
  {
    id: 'bolt',
    name: 'Bolt',
    description: 'Faster bolt cycling and reloads.',
    values: [1, 0.9, 0.8, 0.72, 0.64, 0.56],
    format: (v) => Math.round((1 - v) * 100) + '% faster',
    prices: [200, 450, 800, 1250, 1900]
  }
];

/** Gear: one-time purchases that work with every rifle. */
/** @type {GearDef[]} */
export const GEAR = [
  {
    id: 'windmeter',
    name: 'Wind meter',
    effect: 'The wind readout also shows how far to hold into the wind, in mils, at the rangefinder distance.',
    price: 1500,
    level: 1
  },
  {
    id: 'extmag',
    name: 'Extended magazine',
    effect: '+3 rounds in every rifle.',
    price: 2000,
    level: 2
  },
  {
    id: 'brace',
    name: 'Steady brace',
    effect: 'A bipod-style rest: half the sway while you hold your breath.',
    price: 3000,
    level: 3
  },
  {
    id: 'computer',
    name: 'Ballistic computer',
    effect: 'A dot in the scope marks where the bullet lands at the measured range and wind. Put the dot on the target.',
    price: 5000,
    level: 5
  }
];

/** Extra rounds from the extended magazine. */
export const EXTMAG_ROUNDS = 3;
/** Sway left while holding breath, as a share, with the steady brace. */
export const BRACE_HOLD = 0.5;

/** Current upgrade level (0 to 5) of an upgrade on a rifle. */
export function upgradeLevel(progress, rifleId, upgradeId) {
  const u = (progress.upgrades && progress.upgrades[rifleId]) || {};
  return u[upgradeId] || 0;
}

/** Price of the next level, or null when maxed. */
export function nextPrice(progress, rifleId, upgrade) {
  const lv = upgradeLevel(progress, rifleId, upgrade.id);
  return lv >= upgrade.prices.length ? null : upgrade.prices[lv];
}

/**
 * Buys the next level if the player can afford it. Mutates and returns whether it worked.
 * @param {any} progress
 */
export function buyUpgrade(progress, rifleId, upgrade) {
  const price = nextPrice(progress, rifleId, upgrade);
  if (price === null || progress.cash < price || !ownsRifle(progress, rifleId)) return false;
  progress.cash -= price;
  if (progress.stats) progress.stats.spent += price;
  progress.upgrades = progress.upgrades || {};
  progress.upgrades[rifleId] = progress.upgrades[rifleId] || {};
  progress.upgrades[rifleId][upgrade.id] = upgradeLevel(progress, rifleId, upgrade.id) + 1;
  return true;
}

/** @param {any} progress @param {string} rifleId */
export function ownsRifle(progress, rifleId) {
  return rifleId === 'harrier' || (Array.isArray(progress.owned) && progress.owned.includes(rifleId));
}

/**
 * Whether the player can buy something with a level and price now, or why not.
 * @param {number} cash @param {number} level @param {{ level: number, price: number }} u
 * @returns {{ state: 'buy' | 'locked', reason: string }}
 */
function buyable(cash, level, u) {
  if (level < u.level) return { state: 'locked', reason: 'Reach level ' + u.level };
  if (cash < u.price) return { state: 'locked', reason: 'Earn $' + (u.price - cash).toLocaleString('en-US') + ' more' };
  return { state: 'buy', reason: '' };
}

/**
 * What the Armory can do with a rifle: it is equipped, owned (can equip), buyable now, or
 * locked behind a level or more cash (with the reason).
 * @param {any} progress
 * @param {RifleDef} rifle
 * @param {number} level the player's level
 * @returns {{ state: 'equipped' | 'owned' | 'buy' | 'locked', reason: string }}
 */
export function rifleState(progress, rifle, level) {
  if (ownsRifle(progress, rifle.id)) return { state: progress.rifle === rifle.id ? 'equipped' : 'owned', reason: '' };
  const u = rifle.unlock;
  if (!u) return { state: 'owned', reason: '' };
  return buyable(progress.cash, level, u);
}

/**
 * Buys a rifle when the level and cash allow, and equips it. Mutates; returns whether it worked.
 * @param {any} progress @param {RifleDef} rifle @param {number} level
 */
export function buyRifle(progress, rifle, level) {
  if (rifleState(progress, rifle, level).state !== 'buy') return false;
  progress.cash -= rifle.unlock.price;
  if (progress.stats) progress.stats.spent += rifle.unlock.price;
  progress.owned = [...new Set([...(progress.owned || ['harrier']), rifle.id])];
  progress.rifle = rifle.id;
  return true;
}

/** Equips an owned rifle. @param {any} progress @param {string} rifleId */
export function equipRifle(progress, rifleId) {
  if (!ownsRifle(progress, rifleId)) return false;
  progress.rifle = rifleId;
  return true;
}

/** @param {any} progress @param {string} gearId */
export function ownsGear(progress, gearId) {
  return Array.isArray(progress.gear) && progress.gear.includes(gearId);
}

/**
 * @param {any} progress @param {GearDef} gear @param {number} level
 * @returns {{ state: 'owned' | 'buy' | 'locked', reason: string }}
 */
export function gearState(progress, gear, level) {
  if (ownsGear(progress, gear.id)) return { state: 'owned', reason: '' };
  return buyable(progress.cash, level, gear);
}

/**
 * Buys a piece of gear once, when the level and cash allow. Mutates; returns whether it worked.
 * @param {any} progress @param {GearDef} gear @param {number} level
 */
export function buyGear(progress, gear, level) {
  if (gearState(progress, gear, level).state !== 'buy') return false;
  progress.cash -= gear.price;
  if (progress.stats) progress.stats.spent += gear.price;
  progress.gear = [...new Set([...(Array.isArray(progress.gear) ? progress.gear : []), gear.id])];
  return true;
}

/**
 * Store bars for a rifle, each 0..1: power (velocity and drag), stability (sway), fire rate
 * (bolt time) and magazine (rounds, out of the largest magazine with the extended one).
 * @param {RifleDef} rifle
 */
export function statBars(rifle) {
  const r = { ...KESTREL, ...rifle.stats };
  const clamp = (v) => Math.max(0.06, Math.min(1, v));
  return {
    power: clamp(((r.velocity - 600) / 400) * 0.7 + ((0.0007 - r.drag) / 0.00045) * 0.3),
    stability: clamp((1.7 - r.swayMul) / 0.85),
    fireRate: clamp((1.9 - r.boltTime) / 1.6),
    magazine: clamp(r.magazine / 10),
    rounds: r.magazine
  };
}

/**
 * The gameplay numbers for the equipped rifle, its upgrades, its trait and the owned gear.
 * `rifle` holds the stat overrides for KESTREL (the magazine always set, gear included);
 * `holdSwayMul` scales the sway left while holding breath.
 * @param {any} progress
 * @returns {{ maxZoom: number, swayMul: number, breathTime: number, boltMul: number,
 *   holdSwayMul: number, rifleId: string, traits: RifleTraits,
 *   gear: Record<GearId, boolean>, rifle: Partial<import('./ballistics.js').Rifle> }}
 */
export function loadoutFor(progress) {
  const rifle = ownsRifle(progress, progress.rifle) ? progress.rifle : 'harrier';
  const v = (id) => {
    const u = UPGRADES.find((x) => x.id === id);
    return u.values[upgradeLevel(progress, rifle, id)];
  };
  const def = RIFLES.find((r) => r.id === rifle) || RIFLES[0];
  const traits = def.traits || {};
  /** @type {Record<GearId, boolean>} */
  const gear = { windmeter: false, extmag: false, brace: false, computer: false };
  for (const g of GEAR) gear[g.id] = ownsGear(progress, g.id);
  const magazine = (def.stats.magazine ?? KESTREL.magazine) + (gear.extmag ? EXTMAG_ROUNDS : 0);
  return {
    maxZoom: v('scope') + (traits.zoomBonus || 0),
    swayMul: v('stability'),
    breathTime: v('breath') + (traits.breathBonus || 0),
    boltMul: v('bolt'),
    holdSwayMul: gear.brace ? BRACE_HOLD : 1,
    rifleId: def.id,
    traits,
    gear,
    rifle: { ...def.stats, magazine }
  };
}
