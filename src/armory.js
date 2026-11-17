// @ts-check
// Rifles, upgrades and contracts for the menus. Everything is bought with cash earned by
// playing; there is no paid currency.

/**
 * @typedef {{ id: string, name: string, calibre: string, description: string,
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
    description: 'A long-range bolt rifle with a folding stock. Accurate, heavy and loud.',
    unlock: null
  },
  {
    id: 'osprey',
    name: 'Osprey .50',
    calibre: '.50 BMG, bullpup',
    description: 'Anti-materiel rifle for the longest shots. Arrives with a later contract.',
    unlock: { level: 5, price: 6000 }
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

/**
 * Contract list for the Contracts screen. Only Harbor Plaza is built; the others show what is
 * coming and what unlocks them.
 * @typedef {{ id: string, number: number, title: string, district: string, playable: boolean,
 *   needs: string | null }} ContractCard
 * @type {ContractCard[]}
 */
export const CONTRACTS = [
  { id: 'harbor-plaza', number: 1, title: 'Harbor Plaza', district: 'Financial District, 14:20', playable: true, needs: null },
  { id: 'dockside', number: 2, title: 'Dockside', district: 'Container Port, 18:05', playable: false, needs: 'Complete Harbor Plaza' },
  { id: 'rooftop-gala', number: 3, title: 'Rooftop Gala', district: 'Old Town, 21:40', playable: false, needs: 'Reach level 4' }
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
  if (price === null || progress.cash < price) return false;
  progress.cash -= price;
  progress.upgrades = progress.upgrades || {};
  progress.upgrades[rifleId] = progress.upgrades[rifleId] || {};
  progress.upgrades[rifleId][upgrade.id] = upgradeLevel(progress, rifleId, upgrade.id) + 1;
  return true;
}

/**
 * The gameplay numbers for the equipped rifle and its upgrades.
 * @returns {{ maxZoom: number, swayMul: number, breathTime: number, boltMul: number }}
 */
export function loadoutFor(progress) {
  const rifle = progress.rifle || 'harrier';
  const v = (id) => {
    const u = UPGRADES.find((x) => x.id === id);
    return u.values[upgradeLevel(progress, rifle, id)];
  };
  return { maxZoom: v('scope'), swayMul: v('stability'), breathTime: v('breath'), boltMul: v('bolt') };
}
