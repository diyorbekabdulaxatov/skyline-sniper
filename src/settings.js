// @ts-check
// Player settings and best times, kept in localStorage. Storage can be missing or blocked
// (private windows, previews), so every access is guarded and defaults always work.

const KEY = 'skyline.settings.v1';
const BEST_KEY = 'skyline.best.v1';

/**
 * @typedef {{ quality: 'auto' | 'low' | 'medium' | 'high', sensitivity: number,
 *   gyro: 'off' | 'scope' | 'always', sound: boolean, trail: boolean,
 *   markers: boolean, bulletCam: boolean }} Settings
 */

/** @type {Settings} */
export const DEFAULTS = {
  quality: 'auto', sensitivity: 1, gyro: 'off', sound: true, trail: true, markers: true, bulletCam: true
};

/** @returns {Settings} */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

/** @param {Settings} s */
export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (err) {
    /* storage unavailable */
  }
}

/** Best clear time in seconds per mission id, or null. */
export function loadBest(id) {
  try {
    const all = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
    return typeof all[id] === 'number' ? all[id] : null;
  } catch (err) {
    return null;
  }
}

export function saveBest(id, seconds) {
  try {
    const all = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
    all[id] = seconds;
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch (err) {
    /* storage unavailable */
  }
}
