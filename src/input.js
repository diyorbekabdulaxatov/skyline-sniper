// @ts-check
// Touch, mouse, keyboard and gyro input. Look movement is accumulated here and read once per
// frame by the game; buttons call handlers directly.

/**
 * @typedef {{ fire: () => void, scope: () => void, breath: (on: boolean) => void,
 *   reload: () => void, zoom: (steps: number) => void, pause: () => void }} Handlers
 */

/**
 * @param {HTMLElement} surface the element that takes drag-to-look
 * @param {Handlers} handlers
 */
export function createInput(surface, handlers) {
  const look = { dx: 0, dy: 0 };
  const gyro = { yaw: 0, pitch: 0, seen: false, enabled: false, last: 0 };
  /** @type {number | null} */
  let lookId = null;
  let lx = 0;
  let ly = 0;

  surface.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button === 2) {
      handlers.scope();
      return;
    }
    if (lookId !== null) return;
    lookId = e.pointerId;
    lx = e.clientX;
    ly = e.clientY;
    try {
      surface.setPointerCapture(e.pointerId);
    } catch (err) {
      /* capture is optional */
    }
  });
  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    look.dx += e.clientX - lx;
    look.dy += e.clientY - ly;
    lx = e.clientX;
    ly = e.clientY;
  });
  const end = (e) => {
    if (e.pointerId === lookId) lookId = null;
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
  surface.addEventListener('contextmenu', (e) => e.preventDefault());
  surface.addEventListener('wheel', (e) => {
    e.preventDefault();
    handlers.zoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const t = /** @type {HTMLElement} */ (e.target);
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
    switch (e.code) {
      case 'Space': e.preventDefault(); handlers.fire(); break;
      case 'KeyE': case 'KeyQ': handlers.scope(); break;
      case 'ShiftLeft': case 'ShiftRight': handlers.breath(true); break;
      case 'KeyR': handlers.reload(); break;
      case 'Escape': case 'KeyP': handlers.pause(); break;
      case 'Equal': case 'NumpadAdd': handlers.zoom(1); break;
      case 'Minus': case 'NumpadSubtract': handlers.zoom(-1); break;
      default: break;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') handlers.breath(false);
  });

  // Gyro aiming from the rotation rate, integrated with our own clock. In landscape the
  // device's x axis points up the screen, so turning left and right is rotation about x.
  window.addEventListener('devicemotion', (e) => {
    const r = e.rotationRate;
    if (!r || r.alpha === null) return;
    gyro.seen = true;
    const now = performance.now();
    const dt = gyro.last ? Math.min(0.1, (now - gyro.last) / 1000) : 0;
    gyro.last = now;
    if (!gyro.enabled || !dt) return;
    const deg = Math.PI / 180;
    const angle = screenAngle();
    let yawRate;
    let pitchRate;
    if (angle === 90) {
      yawRate = r.beta;
      pitchRate = -r.gamma;
    } else if (angle === 270) {
      yawRate = -r.beta;
      pitchRate = r.gamma;
    } else {
      yawRate = r.gamma;
      pitchRate = r.beta;
    }
    gyro.yaw += yawRate * deg * dt;
    gyro.pitch += pitchRate * deg * dt;
  });

  return {
    /** Look movement in CSS pixels since the last call. */
    consumeLook() {
      const out = { dx: look.dx, dy: look.dy };
      look.dx = 0;
      look.dy = 0;
      return out;
    },
    /** Gyro rotation in radians since the last call. */
    consumeGyro() {
      const out = { yaw: gyro.yaw, pitch: gyro.pitch };
      gyro.yaw = 0;
      gyro.pitch = 0;
      return out;
    },
    /** @param {boolean} on */
    setGyro(on) {
      gyro.enabled = on;
      gyro.yaw = 0;
      gyro.pitch = 0;
    },
    gyroAvailable() {
      return gyro.seen;
    },
    /** iOS asks for motion permission; call this from a tap. */
    async requestGyroPermission() {
      const DM = /** @type {any} */ (window).DeviceMotionEvent;
      if (DM && typeof DM.requestPermission === 'function') {
        try {
          return (await DM.requestPermission()) === 'granted';
        } catch (err) {
          return false;
        }
      }
      return true;
    }
  };
}

function screenAngle() {
  const so = /** @type {any} */ (screen).orientation;
  let a = so && typeof so.angle === 'number' ? so.angle : /** @type {any} */ (window).orientation || 0;
  a = ((a % 360) + 360) % 360;
  return a;
}
