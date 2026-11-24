// @ts-check
// Player progress (the agent's account): cash, experience and level, owned rifles and upgrades,
// and career statistics. Everything is earned only by playing (no paid currency).
// Kept in localStorage; storage can be missing, so every access is guarded.

const KEY = 'skyline.progress.v1';

/**
 * @typedef {{ earned: number, spent: number, shots: number, wins: number, heads: number,
 *   bestDistance: number }} Stats
 * @typedef {{ cash: number, xp: number, contracts: number, tutorialDone: boolean, rifle: string,
 *   owned: string[], upgrades: Record<string, Record<string, number>>, stats: Stats }} Progress
 */

/** @returns {Progress} */
function fresh() {
  return {
    cash: 0, xp: 0, contracts: 0, tutorialDone: false, rifle: 'harrier', owned: ['harrier'], upgrades: {},
    stats: { earned: 0, spent: 0, shots: 0, wins: 0, heads: 0, bestDistance: 0 }
  };
}

/** @returns {Progress} */
export function loadProgress() {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    /** @type {Progress} */
    const p = { ...base, ...saved, stats: { ...base.stats, ...(saved.stats || {}) } };
    // Older saves: no owned list; the starting rifle is always owned and equipped rifles too.
    const owned = new Set(Array.isArray(saved.owned) ? saved.owned : []);
    owned.add('harrier');
    if (!owned.has(p.rifle)) p.rifle = 'harrier';
    p.owned = [...owned];
    if (!Number.isFinite(p.cash) || p.cash < 0) p.cash = 0;
    if (!Number.isFinite(p.xp) || p.xp < 0) p.xp = 0;
    return p;
  } catch (err) {
    return base;
  }
}

/** @param {Progress} p */
export function saveProgress(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (err) {
    /* storage unavailable */
  }
}

/** Wipes the account back to a new agent. @returns {Progress} */
export function resetProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    /* storage unavailable */
  }
  return fresh();
}

/** Experience needed to go from `level` to the next one. */
function xpFor(level) {
  return 400 + (level - 1) * 250;
}

/** Level, progress within it (0..1) and xp still needed, from total experience. */
export function levelOf(xp) {
  let level = 1;
  let rest = xp;
  while (rest >= xpFor(level)) {
    rest -= xpFor(level);
    level++;
  }
  return { level, fraction: rest / xpFor(level), toNext: xpFor(level) - rest };
}

/** The fee for a contract: later contracts are harder and pay more. */
export function contractFee(number) {
  return 500 + (Math.max(1, number) - 1) * 150;
}

/** Share of the pay a replay of an already completed contract earns. */
export const REPLAY_SHARE = 0.4;

/** Cash bonus for reaching a new level, paid once per level. */
export function levelBonus(level) {
  return 150 + level * 100;
}

/**
 * Pay for a contract result. The first completion pays in full; replays pay REPLAY_SHARE of the
 * fee and bonuses (so cash cannot be farmed on the easiest contract), plus $100 for each star
 * better than the previous best. Failed contracts pay nothing but still teach a little.
 * @param {{ result: string, head: boolean, shots: number, time: number, distance: number }} r
 * @param {{ number: number, firstClear: boolean, newStars: number }} c
 * @returns {{ lines: { label: string, cash: number }[], cash: number, xp: number }}
 */
export function rewardFor(r, c) {
  if (r.result !== 'win') return { lines: [], cash: 0, xp: 40 };
  const k = c.firstClear ? 1 : REPLAY_SHARE;
  const pay = (v) => Math.round((v * k) / 10) * 10;
  const lines = [{ label: c.firstClear ? 'Contract fee' : 'Replay fee (' + Math.round(REPLAY_SHARE * 100) + '%)', cash: pay(contractFee(c.number)) }];
  if (r.head) lines.push({ label: 'Headshot', cash: pay(250) });
  if (r.shots === 1) lines.push({ label: 'One shot', cash: pay(150) });
  if (r.time < 45) lines.push({ label: 'Fast work', cash: pay(100) });
  if (r.distance > 150) lines.push({ label: 'Long range', cash: pay((r.distance - 150) * 2) });
  if (c.newStars > 0) lines.push({ label: c.newStars === 1 ? 'New star' : c.newStars + ' new stars', cash: c.newStars * 100 });
  const cash = lines.reduce((s, l) => s + l.cash, 0);
  return { lines, cash, xp: Math.round((200 + cash / 5) * (c.firstClear ? 1 : 0.6)) };
}
