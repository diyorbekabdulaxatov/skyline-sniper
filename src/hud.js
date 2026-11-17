// @ts-check
// In-game HUD: DOM text and buttons over the 3D view. Writes only when a value changes.

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

export function createHud() {
  const el = {
    root: $('hud'),
    objective: $('hud-objective'),
    timer: $('hud-timer'),
    wind: $('hud-wind'),
    windArrow: $('hud-wind-arrow'),
    range: $('hud-range'),
    ammo: $('hud-ammo'),
    status: $('hud-status'),
    intel: $('hud-intel'),
    flash: $('hud-flash'),
    zoomWrap: $('zoom-wrap'),
    zoom: /** @type {HTMLInputElement} */ ($('zoom')),
    zoomLabel: $('zoom-label'),
    breath: $('btn-breath'),
    scope: $('btn-scope'),
    fire: $('btn-fire'),
    crosshair: $('crosshair'),
    marker: $('target-marker'),
    hint: $('hud-hint')
  };
  /** @type {Record<string, any>} */
  const last = {};
  let intelTimer = 0;
  let flashTimer = 0;

  function set(key, node, text) {
    if (last[key] === text) return;
    last[key] = text;
    node.textContent = text;
  }

  return {
    el,
    /** @param {boolean} on */
    show(on) {
      el.root.hidden = !on;
    },
    objective(text) {
      set('objective', el.objective, text);
    },
    /** @param {number} seconds remaining, or -1 to hide */
    timer(seconds) {
      const text = seconds < 0 ? '' : Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
      set('timer', el.timer, text);
      const urgent = seconds >= 0 && seconds < 15;
      if (last.urgent !== urgent) {
        last.urgent = urgent;
        el.timer.classList.toggle('urgent', urgent);
      }
    },
    /** @param {number} w crosswind in m/s, positive blows right */
    wind(w) {
      set('wind', el.wind, Math.abs(w).toFixed(1) + ' m/s');
      set('windArrow', el.windArrow, w >= 0 ? '→' : '←');
    },
    /** @param {number | null} m */
    range(m) {
      set('range', el.range, m === null ? '---' : String(Math.round(m)));
    },
    ammo(n, mag, status) {
      set('ammo', el.ammo, n + ' / ' + mag);
      set('status', el.status, status);
    },
    /** @param {string} text */
    intel(text) {
      el.intel.textContent = text;
      el.intel.classList.add('on');
      intelTimer = 3.5;
    },
    /** @param {string} text @param {'good' | 'bad' | 'plain'} tone */
    flash(text, tone) {
      el.flash.textContent = text;
      el.flash.dataset.tone = tone;
      el.flash.classList.add('on');
      flashTimer = 2.2;
    },
    breath(level, holding, tired) {
      const p = Math.round(level * 100) / 100;
      if (last.breath !== p) {
        last.breath = p;
        el.breath.style.setProperty('--p', String(p));
      }
      const state = tired ? 'tired' : holding ? 'holding' : '';
      if (last.breathState !== state) {
        last.breathState = state;
        el.breath.dataset.state = state;
      }
    },
    scoped(scoped, zoom) {
      if (last.scoped !== scoped) {
        last.scoped = scoped;
        el.zoomWrap.hidden = !scoped;
        el.crosshair.hidden = scoped;
        el.scope.classList.toggle('active', scoped);
        el.root.classList.toggle('scoped', scoped);
      }
      const z = zoom.toFixed(1);
      if (last.zoom !== z) {
        last.zoom = z;
        el.zoom.value = z;
        el.zoomLabel.textContent = z + '×';
      }
    },
    fireReady(ready) {
      if (last.fireReady !== ready) {
        last.fireReady = ready;
        el.fire.classList.toggle('cycling', !ready);
      }
    },
    /**
     * Places the target marker at a screen point, or hides it.
     * @param {{ x: number, y: number, dist: number } | null} p
     */
    marker(p) {
      if (!p) {
        if (!el.marker.hidden) el.marker.hidden = true;
        return;
      }
      el.marker.hidden = false;
      el.marker.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      const dist = Math.round(p.dist) + ' m';
      if (last.markerDist !== dist) {
        last.markerDist = dist;
        el.marker.dataset.dist = dist;
      }
    },
    /** Sets the zoom slider's top end to the rifle's maximum magnification. */
    zoomRange(max) {
      el.zoom.max = String(max);
    },
    /** Crosshair turns green when it is on the target. */
    onTarget(on) {
      if (last.onTarget !== on) {
        last.onTarget = on;
        el.root.classList.toggle('on-target', on);
      }
    },
    /**
     * Tutorial hint: a text bubble pointing at a button (or the screen centre when id is null).
     * @param {string | null} text
     * @param {string | null} [targetId]
     */
    hint(text, targetId) {
      const node = el.hint;
      const key = text + '|' + targetId;
      if (last.hint === key) return;
      last.hint = key;
      for (const b of el.root.querySelectorAll('.pulse')) b.classList.remove('pulse');
      if (!text) {
        node.hidden = true;
        return;
      }
      node.hidden = false;
      node.textContent = text;
      const target = targetId ? document.getElementById(targetId) : null;
      if (target) target.classList.add('pulse');
      const r = target ? target.getBoundingClientRect() : null;
      // Hints about the view sit under the objective banner, clear of the target.
      const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const y = r ? r.top : 56;
      node.dataset.side = !r ? 'top' : x > window.innerWidth * 0.6 ? 'right' : x < window.innerWidth * 0.4 ? 'left' : 'center';
      node.style.left = x + 'px';
      node.style.top = y + 'px';
    },
    /** Hides everything for the bullet cam. */
    cinematic(on) {
      if (last.cinematic !== on) {
        last.cinematic = on;
        el.root.classList.toggle('cinematic', on);
      }
    },
    tick(dt) {
      if (intelTimer > 0) {
        intelTimer -= dt;
        if (intelTimer <= 0) el.intel.classList.remove('on');
      }
      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) el.flash.classList.remove('on');
      }
    },
    reset() {
      intelTimer = 0;
      flashTimer = 0;
      el.intel.classList.remove('on');
      el.flash.classList.remove('on');
      el.marker.hidden = true;
      el.hint.hidden = true;
      last.hint = '';
      el.root.classList.remove('cinematic');
      last.cinematic = false;
    }
  };
}
