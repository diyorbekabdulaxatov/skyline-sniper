// @ts-check
// Background music: a slow stealth loop in the menus and a tense loop during contracts
// (CC0 tracks from OpenGameArt, fetched in CI into public/game-assets/music/, see assets.json).
// Plain <audio> elements, cross-faded; quieter while paused. Browsers only
// play after a tap, so unlock() is called from the first touch. Missing files are ignored.

const BASE = './game-assets/music/';
const VOLUMES = { off: 0, low: 0.25, medium: 0.5, high: 0.8 };

/** @typedef {'menu' | 'mission'} Track */

export function createMusic() {
  /** @type {Record<Track, HTMLAudioElement | null>} */
  const tracks = { menu: null, mission: null };
  /** @type {Track | null} */
  let current = null;
  let level = VOLUMES.medium;
  let duck = 1;
  let unlocked = false;
  let hidden = false;
  /** Per-track fade gain (0..1), moved toward its target every frame. */
  const fade = { menu: 0, mission: 0 };
  let raf = 0;

  /** @param {Track} name */
  function element(name) {
    if (tracks[name]) return tracks[name];
    try {
      const a = new Audio(BASE + name + '.ogg');
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      a.addEventListener('error', () => {
        tracks[name] = null;
      });
      tracks[name] = a;
      return a;
    } catch (err) {
      return null;
    }
  }

  function tick() {
    raf = 0;
    let moving = false;
    for (const name of /** @type {Track[]} */ (['menu', 'mission'])) {
      const a = tracks[name];
      const target = name === current && !hidden ? 1 : 0;
      const step = 0.04;
      if (Math.abs(fade[name] - target) > step) {
        fade[name] += fade[name] < target ? step : -step;
        moving = true;
      } else {
        fade[name] = target;
      }
      if (!a) continue;
      a.volume = Math.max(0, Math.min(1, fade[name] * level * duck));
      if (fade[name] === 0 && !a.paused) a.pause();
    }
    if (moving) raf = requestAnimationFrame(tick);
  }

  function update() {
    const a = current && element(current);
    if (a && unlocked && !hidden && level > 0 && a.paused) {
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  return {
    /** Call from a touch: browsers block sound until then. */
    unlock() {
      if (unlocked) return;
      unlocked = true;
      update();
    },
    /** Cross-fades to a track. @param {Track} name */
    play(name) {
      current = name;
      update();
    },
    /** @param {'off' | 'low' | 'medium' | 'high'} v */
    setVolume(v) {
      level = VOLUMES[v] ?? VOLUMES.medium;
      update();
    },
    /** Quieter while the game is paused. @param {boolean} on */
    duck(on) {
      duck = on ? 0.35 : 1;
      update();
    },
    /** Silence while the app is in the background. @param {boolean} on */
    setHidden(on) {
      hidden = on;
      if (on) for (const a of Object.values(tracks)) if (a) a.pause();
      update();
    }
  };
}
