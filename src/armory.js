// @ts-check
// Rifles and upgrades for the Armory. Everything is bought with cash earned by
// playing; there is no paid currency.

/**
 * `stats` override the base rifle in ballistics.js (KESTREL) for gameplay: muzzle velocity
 * (m/s), drag, magazine, bolt and reload times (s), sway multiplier.
 * @typedef {{ id: string, name: string, calibre: string, description: string,
 *   stats: Partial<import('./ballistics.js').Rifle>,
 *   unlock: { level: number, price: number } | null }} RifleDef
 * @typedef {{ id: 'scope' | 'stability' | 'breath' | 'bolt', name: string, description: string,
 *   values: number[], format: (v: number) => string, prices: number[] }} UpgradeDef
 */

/** @type {RifleDef[]} */
export const RIFLES = [
  {
    id: 'harrier',
    name: 'Harrier .338',
    calibre: '.338 Magnum, bolt action',
    description: 'A long-range bolt rifle with a folding stock. Accurate, quick to cycle and steady to hold.',
    stats: {},
    unlock: null
  },
  {
    id: 'osprey',
    name: 'Osprey .50',
    calibre: '.50 BMG, bullpup',
    description: 'Anti-materiel rifle: a faster, flatter bullet that drops less and drifts less in the wind, for the longest shots. Heavier to hold steady and slower to cycle.',
    stats: { velocity: 900, drag: 0.00034, magazine: 5, boltTime: 1.35, reloadTime: 3.0, swayMul: 1.2 },
    unlock: { level: 4, price: 4500 }
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
  if (level < u.level) return { state: 'locked', reason: 'Reach level ' + u.level };
  if (progress.cash < u.price) return { state: 'locked', reason: 'Earn $' + (u.price - progress.cash).toLocaleString('en-US') + ' more' };
  return { state: 'buy', reason: '' };
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

/**
 * The gameplay numbers for the equipped rifle and its upgrades.
 * @returns {{ maxZoom: number, swayMul: number, breathTime: number, boltMul: number,
 *   rifle: Partial<import('./ballistics.js').Rifle> }}
 */
export function loadoutFor(progress) {
  const rifle = ownsRifle(progress, progress.rifle) ? progress.rifle : 'harrier';
  const v = (id) => {
    const u = UPGRADES.find((x) => x.id === id);
    return u.values[upgradeLevel(progress, rifle, id)];
  };
  const def = RIFLES.find((r) => r.id === rifle) || RIFLES[0];
  return { maxZoom: v('scope'), swayMul: v('stability'), breathTime: v('breath'), boltMul: v('bolt'), rifle: def.stats };
}
