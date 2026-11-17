// @ts-check
// Player progress: cash, experience and level, earned only by playing (no paid currency).
// Kept in localStorage; storage can be missing, so every access is guarded.

const KEY = 'skyline.progress.v1';

/** @typedef {{ cash: number, xp: number, contracts: number, tutorialDone: boolean }} Progress */

/** @returns {Progress} */
export function loadProgress() {
  const base = { cash: 0, xp: 0, contracts: 0, tutorialDone: false };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...base, ...JSON.parse(raw) } : base;
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

/**
 * Pay for a contract result. Failed contracts pay nothing but still teach a little.
 * @param {{ result: string, head: boolean, shots: number, time: number, distance: number }} r
 * @returns {{ lines: { label: string, cash: number }[], cash: number, xp: number }}
 */
export function rewardFor(r) {
  if (r.result !== 'win') return { lines: [], cash: 0, xp: 40 };
  const lines = [{ label: 'Contract fee', cash: 500 }];
  if (r.head) lines.push({ label: 'Headshot', cash: 250 });
  if (r.shots === 1) lines.push({ label: 'One shot', cash: 150 });
  if (r.time < 45) lines.push({ label: 'Fast work', cash: 100 });
  if (r.distance > 150) lines.push({ label: 'Long range', cash: Math.round((r.distance - 150) * 2) });
  const cash = lines.reduce((s, l) => s + l.cash, 0);
  return { lines, cash, xp: 200 + Math.round(cash / 5) };
}
