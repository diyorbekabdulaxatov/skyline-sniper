// @ts-check
// The game: renderer and lighting, camera and scope, sway and breath, firing and bullet
// flight, hits, the mission rules (target, civilians, escape) and the slow-motion bullet cam.
import * as THREE from 'three';
import { KESTREL, zeroAngle, shotAt, step, segmentBox, SOUND_SPEED } from './ballistics.js';
import { drawScope, clearScope } from './scope.js';
import { loadManifest, loadGLTF, measure } from './assets.js';
import { setupLighting } from './lighting.js';
import { buildCity, LAYOUT } from './city.js';
import { createCrowd } from './people.js';
import { HARBOR } from './missions.js';

const BASE_FOV = 55;
const SCOPE_REF_FOV = 28;
const ZOOM_MIN = 2;
const ZOOM_MAX = 16;
const YAW_LIMIT = 1.25;
const PITCH_MIN = -0.95;
const PITCH_MAX = 0.35;
const SWAY = 0.0016;
const SUBSTEP = 1 / 1000;
/** @type {Record<string, number>} */
const QUALITY_RATIO = { low: 1, medium: 1.5, high: 2 };

function scopeFov(zoom) {
  return (2 * Math.atan(Math.tan((SCOPE_REF_FOV * Math.PI) / 360) / zoom) * 180) / Math.PI;
}

/**
 * Builds the world, then returns the game controller.
 * @param {{
 *   canvas: HTMLCanvasElement, scopeCanvas: HTMLCanvasElement,
 *   hud: ReturnType<typeof import('./hud.js').createHud>,
 *   audio: ReturnType<typeof import('./audio.js').createAudio>,
 *   input: ReturnType<typeof import('./input.js').createInput>,
 *   settings: any,
 *   onEnd: (result: any) => void,
 *   onProgress?: (text: string) => void
 * }} opts
 */
export async function createGame(opts) {
  const { canvas, scopeCanvas, hud, audio, input, onEnd } = opts;
  const progress = opts.onProgress || (() => {});
  let settings = opts.settings;
  const mission = HARBOR;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scopeCtx = scopeCanvas.getContext('2d');

  const scene = new THREE.Scene();
  progress('Loading the sky');
  const manifest = await loadManifest();
  const { sun } = await setupLighting(scene, renderer, manifest);

  progress('Building Harbor Plaza');
  const city = await buildCity(scene, manifest);
  progress('Filling the plaza');
  const crowd = await createCrowd(scene);

  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 6000);
  camera.rotation.order = 'YXZ';
  const eye = LAYOUT.eye;
  camera.position.set(eye.x, eye.y, eye.z);
  scene.add(camera);
  const rifleView = await makeRifleView();
  camera.add(rifleView);

  // Bullet for the bullet cam.
  // Bullet for the bullet cam: a boat-tail spitzer, drawn about four times real size so it reads on screen.
  const bulletMesh = makeBullet();
  bulletMesh.visible = false;
  scene.add(bulletMesh);
  const trail = makeTrail(scene);
  const puffs = makePuffs(scene);

  const rifle = KESTREL;
  const zero = zeroAngle(rifle);
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  const tmpDir = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const tmpUp = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const view = { w: 1, h: 1, dpr: 1 };
  const perf = { frames: 0, total: 0, checked: false, auto: 'high' };
  let steady = false;
  let s = freshState();
  let scopeDrawn = false;
  let rangeTimer = 0;
  let last = performance.now();

  function freshState() {
    return {
      mode: 'menu',
      time: 0,
      clock: 0,
      yaw: 0,
      pitch: -0.42,
      scoped: false,
      zoom: 6,
      fov: BASE_FOV,
      ammo: rifle.magazine,
      bolt: 0,
      reload: 0,
      recoil: 0,
      breath: 1,
      holding: false,
      tired: 0,
      swayMul: 1,
      swayT: Math.random() * 100,
      wind: mission.wind.base,
      shots: 0,
      hits: 0,
      heads: 0,
      bullets: [],
      intelIndex: 0,
      panicTimer: -1,
      endTimer: -1,
      result: null,
      killShot: null,
      timeScale: 1,
      cam: null,
      onTarget: false
    };
  }

  // ---------- sizing and quality ----------

  function quality() {
    return settings.quality === 'auto' ? (perf.checked ? perf.auto : 'high') : settings.quality;
  }

  function applyQuality() {
    const q = quality();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY_RATIO[q] || 1.5));
    renderer.setSize(view.w, view.h, false);
    const size = q === 'high' ? 2048 : 1024;
    sun.castShadow = q !== 'low';
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    }
  }

  function resize() {
    view.w = Math.max(1, window.innerWidth);
    view.h = Math.max(1, window.innerHeight);
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    applyQuality();
    camera.aspect = view.w / view.h;
    camera.updateProjectionMatrix();
    scopeCanvas.width = Math.round(view.w * view.dpr);
    scopeCanvas.height = Math.round(view.h * view.dpr);
    scopeDrawn = false;
  }

  function measureFrames(dt) {
    if (settings.quality !== 'auto' || perf.checked || s.mode !== 'playing') return;
    perf.frames++;
    perf.total += dt;
    if (perf.frames < 180) return;
    const avg = perf.total / perf.frames;
    perf.checked = true;
    perf.auto = avg > 1 / 38 ? 'low' : avg > 1 / 50 ? 'medium' : 'high';
    applyQuality();
  }

  // ---------- actions ----------

  function canFire() {
    return s.mode === 'playing' && s.reload <= 0 && s.bolt <= 0 && s.ammo > 0;
  }

  function fire() {
    if (s.mode !== 'playing' || s.reload > 0 || s.bolt > 0) return;
    if (s.ammo <= 0) {
      startReload();
      return;
    }
    camera.updateMatrixWorld();
    camera.getWorldDirection(tmpDir);
    tmpRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    tmpDir.applyAxisAngle(tmpRight, zero);
    tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(rifle.sightHeight);
    const b = {
      x: camera.position.x - tmpUp.x, y: camera.position.y - tmpUp.y, z: camera.position.z - tmpUp.z,
      vx: tmpDir.x * rifle.velocity, vy: tmpDir.y * rifle.velocity, vz: tmpDir.z * rifle.velocity,
      t: 0, drag: rifle.drag
    };
    s.bullets.push(b);
    s.ammo--;
    s.shots++;
    s.bolt = rifle.boltTime;
    s.recoil += s.scoped ? 0.03 : 0.05;
    audio.shot();
    audio.bolt(0.45);
    vibrate(30);
    if (s.panicTimer < 0 && !crowd.panicked) s.panicTimer = 0.25;
    // Bullet cam when this shot will kill the target.
    if (settings.bulletCam && willHitTarget(b)) {
      s.mode = 'bulletcam';
      s.timeScale = 0.04;
      s.cam = { bullet: b, hold: -1 };
      bulletMesh.visible = true;
      hud.cinematic(true);
    }
  }

  /** Flies a copy of the bullet through the current scene to see whether it meets the target. */
  function willHitTarget(b) {
    const c = { ...b };
    const wind = { x: s.wind, z: 0 };
    for (let i = 0; i < 3000; i++) {
      const a = { x: c.x, y: c.y, z: c.z };
      step(c, 1 / 1000, wind);
      const hit = collide(a, c);
      if (hit) return hit.kind === 'person' && hit.person === crowd.target;
    }
    return false;
  }

  function startReload() {
    if (s.mode !== 'playing' || s.reload > 0 || s.ammo === rifle.magazine) return;
    s.reload = rifle.reloadTime;
    audio.reload();
  }

  function toggleScope() {
    if (s.mode !== 'playing') return;
    s.scoped = !s.scoped;
    if (!s.scoped && s.holding) setBreath(false);
  }

  function setZoom(z) {
    s.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  }

  function setBreath(on) {
    if (s.mode !== 'playing') return;
    if (on && (!s.scoped || s.tired > 0 || s.breath < 0.05 || s.holding)) return;
    if (!on && !s.holding) return;
    s.holding = on;
    audio.breath(on);
  }

  // ---------- simulation ----------

  function update(realDt) {
    s.time += realDt;
    s.wind = mission.wind.base + Math.sin(s.time * 0.11) * mission.wind.gust * 0.6 + Math.sin(s.time * 0.31 + 1) * mission.wind.gust * 0.4;

    if (s.mode === 'menu') {
      s.yaw = Math.sin(s.time * 0.05) * 0.35;
      s.pitch = -0.32 + Math.sin(s.time * 0.07) * 0.03;
      s.scoped = false;
      s.fov = BASE_FOV;
      aimCamera(0, 0);
      crowd.update(realDt);
      city.update(realDt);
      return;
    }
    if (s.mode === 'paused' || s.mode === 'over') {
      if (s.mode === 'over') {
        crowd.update(realDt);
        city.update(realDt);
      }
      return;
    }

    const dt = realDt * s.timeScale;
    hud.tick(realDt);

    if (s.mode === 'bulletcam') {
      updateBulletCam(realDt, dt);
      return;
    }

    s.clock += dt;
    const look = input.consumeLook();
    const gyro = input.consumeGyro();
    const k = settings.sensitivity * 0.0032 * (s.fov / BASE_FOV);
    s.yaw -= look.dx * k;
    s.pitch -= look.dy * k;
    if (settings.gyro === 'always' || (settings.gyro === 'scope' && s.scoped)) {
      s.yaw += gyro.yaw;
      s.pitch += gyro.pitch;
    }
    s.yaw = Math.max(-YAW_LIMIT, Math.min(YAW_LIMIT, s.yaw));
    s.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, s.pitch));

    const targetFov = s.scoped ? scopeFov(s.zoom) : BASE_FOV;
    s.fov += (targetFov - s.fov) * Math.min(1, dt * 16);
    if (Math.abs(targetFov - s.fov) < 0.01) s.fov = targetFov;

    if (s.holding) {
      s.breath -= dt / 5;
      if (s.breath <= 0) {
        s.breath = 0;
        s.holding = false;
        s.tired = 2.5;
        audio.breath(false);
      }
    } else {
      s.breath = Math.min(1, s.breath + dt / 3.5);
      if (s.tired > 0) s.tired -= dt;
    }
    const swayTarget = steady ? 0 : rifle.swayMul * (s.holding ? 0.12 : s.tired > 0 ? 2 : 1) * (s.scoped ? 1 : 0.25);
    s.swayMul += (swayTarget - s.swayMul) * Math.min(1, dt * 4);
    s.swayT += dt;
    const swayYaw = SWAY * s.swayMul * (Math.sin(s.swayT * 0.71) * 0.6 + Math.sin(s.swayT * 1.37 + 0.5) * 0.4);
    const swayPitch = SWAY * s.swayMul * (Math.sin(s.swayT * 0.93 + 1.7) * 0.55 + Math.sin(s.swayT * 1.71) * 0.45);
    s.recoil *= Math.exp(-dt * 7);
    aimCamera(swayYaw, swayPitch);

    if (s.bolt > 0) s.bolt -= dt;
    if (s.reload > 0) {
      s.reload -= dt;
      if (s.reload <= 0) {
        s.reload = 0;
        s.ammo = rifle.magazine;
      }
    } else if (s.ammo === 0 && s.bolt <= 0) {
      startReload();
    }

    world(dt);

    while (s.intelIndex < mission.intel.length && s.clock >= mission.intel[s.intelIndex].at) {
      hud.intel(mission.intel[s.intelIndex].text);
      s.intelIndex++;
    }

    rangeTimer -= dt;
    if (rangeTimer <= 0) {
      rangeTimer = 0.1;
      raycaster.setFromCamera(center, camera);
      const hits = raycaster.intersectObjects(city.rangeMeshes, false);
      hud.range(hits.length ? hits[0].distance : null);
    }

    hud.objective(crowd.target.alive ? 'Eliminate ' + mission.target.name : 'Target down');
    hud.timer(timeLeft());
    hud.wind(s.wind);
    hud.ammo(s.ammo, rifle.magazine, s.reload > 0 ? 'RELOADING' : s.bolt > 0 ? 'BOLT' : s.ammo === 0 ? 'EMPTY' : 'READY');
    hud.breath(s.breath, s.holding, s.tired > 0);
    hud.scoped(s.scoped, s.zoom);
    hud.fireReady(canFire());
    updateMarker();

    if (s.endTimer > 0) {
      s.endTimer -= dt;
      if (s.endTimer <= 0) finish();
    }
  }

  /** Everything that moves: people, cars, bullets, effects and panic. */
  function world(dt) {
    crowd.update(dt);
    city.update(dt);
    flyBullets(dt);
    puffs.update(dt);
    trail.update(dt);
    if (s.panicTimer > 0) {
      s.panicTimer -= dt;
      if (s.panicTimer <= 0) {
        crowd.panic();
        if (crowd.target.alive) hud.intel('He heard the shot. He is running for the car!');
      }
    }
    // The target reaching his car ends the contract.
    const t = crowd.target;
    if (t.alive && s.result === null && t.mode === 'idle' && t.index === t.path.length - 1 && t.path.length > 0) {
      const car = LAYOUT.targetCar;
      if (Math.hypot(t.x - (car.x - 2.4), t.z - (car.z + 1.2)) < 0.5) {
        t.mode = 'gone';
        t.root.visible = false;
        s.result = 'escaped';
        s.endTimer = 3;
        hud.flash('The target got away', 'bad');
      }
    }
    if (s.result === 'escaped') city.targetCar.position.x += dt * Math.min(14, (3 - s.endTimer) * 6);
  }

  /** Rough seconds until the target reaches his car, for the HUD clock. */
  function timeLeft() {
    const t = crowd.target;
    if (!t.alive || t.mode === 'gone') return -1;
    let dist = 0;
    let px = t.x;
    let pz = t.z;
    let wait = t.wait;
    for (let i = t.index; i < t.path.length; i++) {
      const p = t.path[i];
      dist += Math.hypot(p.x - px, p.z - pz);
      px = p.x;
      pz = p.z;
      if (i > t.index && p.wait) wait += p.wait;
    }
    return dist / t.speed + wait;
  }

  function aimCamera(swayYaw, swayPitch) {
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(s.pitch + swayPitch + s.recoil, s.yaw + swayYaw, 0);
    if (Math.abs(camera.fov - s.fov) > 1e-4) {
      camera.fov = s.fov;
      camera.updateProjectionMatrix();
    }
    rifleView.visible = s.fov > BASE_FOV * 0.8;
    rifleView.position.z = -0.36 + s.recoil * 1.2;
    rifleView.rotation.x = s.recoil * 2.5;
  }

  /** Whether the centre of the view is on the target's body (ignores bullet drop). */
  function aimOnTarget() {
    const t = crowd.target;
    if (!t.alive || t.mode === 'gone') return false;
    const base = t.root.position.y;
    tmpV.set(t.x, base + 0.935 * t.h, t.z).project(camera);
    const headX = tmpV.x;
    const headY = tmpV.y;
    if (tmpV.z > 1) return false;
    tmpV.set(t.x, base + 0.05 * t.h, t.z).project(camera);
    const footY = tmpV.y;
    const height = Math.abs(headY - footY);
    const halfWidth = (height / 0.9) * 0.17 * (view.h / view.w);
    const top = Math.max(headY, footY) + height * 0.07;
    const bottom = Math.min(headY, footY);
    return Math.abs(headX) < halfWidth && 0 < top && 0 > bottom;
  }

  function updateMarker() {
    const t = crowd.target;
    s.onTarget = s.mode === 'playing' && aimOnTarget();
    hud.onTarget(s.onTarget);
    if (!settings.markers || !t.alive || t.mode === 'gone' || s.mode !== 'playing') {
      hud.marker(null);
      return;
    }
    tmpV.set(t.x, t.root.position.y + t.h + 0.45, t.z).project(camera);
    if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.05 || Math.abs(tmpV.y) > 1.05) {
      hud.marker(null);
      return;
    }
    const x = (tmpV.x * 0.5 + 0.5) * view.w;
    const y = (-tmpV.y * 0.5 + 0.5) * view.h;
    hud.marker({ x, y, dist: Math.hypot(t.x - eye.x, t.root.position.y + 1.5 - eye.y, t.z - eye.z) });
  }

  function flyBullets(dt) {
    const wind = { x: s.wind, z: 0 };
    for (let i = s.bullets.length - 1; i >= 0; i--) {
      const b = s.bullets[i];
      let remaining = dt;
      let done = false;
      while (remaining > 1e-7 && !done) {
        const h = Math.min(SUBSTEP, remaining);
        remaining -= h;
        const a = { x: b.x, y: b.y, z: b.z };
        step(b, h, wind);
        const hit = collide(a, b);
        if (hit) {
          resolveHit(hit, b);
          done = true;
        } else if (b.t > 3 || b.y < -2) {
          done = true;
        }
      }
      if (settings.trail || s.mode === 'bulletcam') {
        const back = s.mode === 'bulletcam' ? 0.004 : 0.035;
        trail.set({ x: b.x - b.vx * back, y: b.y - b.vy * back, z: b.z - b.vz * back }, b);
      }
      if (done) s.bullets.splice(i, 1);
    }
  }

  function collide(a, b) {
    /** @type {any} */
    let best = null;
    const consider = (hit) => {
      if (hit && (!best || hit.t < best.t)) best = hit;
    };
    const floor = 0.12;
    if (b.y <= floor && a.y > floor) consider({ t: (a.y - floor) / (a.y - b.y), kind: 'ground' });
    for (const box of city.colliders) {
      const t = segmentBox(a, b, box);
      if (t !== null) consider({ t, kind: 'wall' });
    }
    for (const box of city.carColliders) {
      const t = segmentBox(a, b, box);
      if (t !== null) consider({ t, kind: 'car' });
    }
    const p = crowd.hitTest(a, b);
    if (p) consider({ t: p.t, kind: 'person', part: p.part, person: p.person });
    if (best) {
      best.x = a.x + (b.x - a.x) * best.t;
      best.y = a.y + (b.y - a.y) * best.t;
      best.z = a.z + (b.z - a.z) * best.t;
    }
    return best;
  }

  function resolveHit(hit, b) {
    const dist = Math.hypot(hit.x - eye.x, hit.y - eye.y, hit.z - eye.z);
    if (hit.kind === 'person') {
      const person = hit.person;
      person.kill();
      audio.impact(dist / SOUND_SPEED, 'person', dist);
      puffs.add(hit, '#7a1f1f', 0.35);
      if (person === crowd.target) {
        s.hits++;
        if (hit.part === 'head') s.heads++;
        s.killShot = { part: hit.part, dist, time: b.t };
        if (s.result === null) {
          s.result = 'win';
          hud.flash((hit.part === 'head' ? 'Headshot' : 'Target down') + ' · ' + Math.round(dist) + ' m', 'good');
          s.endTimer = s.mode === 'bulletcam' ? 99 : 2.2;
        }
        if (s.mode === 'bulletcam' && s.cam) {
          s.cam.hold = 1.8;
          s.cam.focus = { x: hit.x, y: hit.y, z: hit.z };
          s.timeScale = 0.22;
        }
      } else {
        if (s.result === null) {
          s.result = 'civilian';
          s.endTimer = 2.4;
          hud.flash('Civilian casualty. Contract terminated.', 'bad');
        }
        endBulletCam();
      }
      return;
    }
    audio.impact(dist / SOUND_SPEED, 'earth', dist);
    puffs.add(hit, hit.kind === 'car' ? '#d9d9d9' : '#b9b0a2', Math.min(2.2, 0.5 + dist / 200));
    if (s.result === null) hud.flash('Miss · ' + Math.round(dist) + ' m', 'plain');
    endBulletCam();
  }

  function updateBulletCam(realDt, dt) {
    const c = s.cam;
    world(dt);
    const b = c.bullet;
    if (c.hold < 0 && s.bullets.indexOf(b) >= 0) {
      // Behind and slightly beside the bullet, looking along its path.
      tmpDir.set(b.vx, b.vy, b.vz).normalize();
      bulletMesh.position.set(b.x, b.y, b.z);
      bulletMesh.lookAt(b.x + tmpDir.x, b.y + tmpDir.y, b.z + tmpDir.z);
      tmpRight.crossVectors(tmpDir, new THREE.Vector3(0, 1, 0)).normalize();
      // Close behind and beside the bullet, with a slow drift around it.
      c.spin = (c.spin || 0) + realDt * 0.5;
      const side = 0.16 + Math.sin(c.spin) * 0.04;
      camera.position.set(
        b.x - tmpDir.x * 0.42 + tmpRight.x * side,
        b.y - tmpDir.y * 0.42 + 0.07,
        b.z - tmpDir.z * 0.42 + tmpRight.z * side
      );
      camera.lookAt(b.x + tmpDir.x * 3, b.y + tmpDir.y * 3, b.z + tmpDir.z * 3);
      bulletMesh.rotateZ(realDt * 6);
      setFov(36);
      // Speed up a little in the middle of long flights, slow down near the end.
      s.timeScale = Math.min(0.15, s.timeScale + realDt * 0.05);
    } else if (c.hold >= 0) {
      bulletMesh.visible = false;
      const f = c.focus;
      const t = crowd.target;
      c.orbit = (c.orbit || 0) + realDt * 0.35;
      camera.position.set(f.x + Math.sin(c.orbit + 0.6) * 3.2, f.y + 0.6, f.z + Math.cos(c.orbit + 0.6) * 3.2);
      camera.lookAt(t.x, t.root.position.y + 1.0, t.z);
      setFov(42);
      c.hold -= realDt;
      if (c.hold <= 0) {
        endBulletCam();
        finish();
      }
    } else {
      endBulletCam();
    }
  }

  function setFov(f) {
    if (camera.fov !== f) {
      camera.fov = f;
      camera.updateProjectionMatrix();
    }
  }

  function endBulletCam() {
    if (s.mode !== 'bulletcam') return;
    s.mode = 'playing';
    s.timeScale = 1;
    s.cam = null;
    bulletMesh.visible = false;
    hud.cinematic(false);
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
  }

  function skipCinematic() {
    if (s.mode === 'bulletcam' && s.cam) s.timeScale = 1;
  }

  function finish() {
    if (s.mode === 'over') return;
    const result = s.result || 'escaped';
    s.mode = 'over';
    s.scoped = false;
    s.holding = false;
    hud.marker(null);
    const kill = s.killShot;
    onEnd({
      result,
      time: s.clock,
      shots: s.shots,
      hits: s.hits,
      head: !!(kill && kill.part === 'head'),
      distance: kill ? kill.dist : 0,
      stars: result === 'win' ? 1 + (kill && kill.part === 'head' ? 1 : 0) + (s.shots === 1 ? 1 : 0) : 0
    });
  }

  // ---------- rendering ----------

  function render() {
    renderer.render(scene, camera);
    const showScope = s.scoped && s.mode === 'playing' && s.fov < BASE_FOV * 0.8;
    if (showScope) {
      drawScope(scopeCtx, view.w, view.h, view.dpr, s.fov, { onTarget: s.onTarget, zoom: s.zoom });
      scopeDrawn = true;
    } else if (scopeDrawn) {
      clearScope(scopeCtx, view.w, view.h, view.dpr);
      scopeDrawn = false;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      update(dt);
      measureFrames(dt);
      render();
    } catch (err) {
      console.error(err);
    }
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  /** First-person rifle: the CC0 model, scaled to 1.15 m with the muzzle pointing away. */
  async function makeRifleView() {
    const holder = new THREE.Group();
    holder.position.set(0.17, -0.2, -0.36);
    holder.rotation.y = 0.03;
    try {
      // Placeholder AWM-style model (CC BY-NC-SA, test builds only: replace before release),
      // falling back to the CC0 rifle. Used once, so the loaded scene is used directly
      // (cloning a skinned model would leave it bound to the original skeleton).
      let gltf;
      try {
        gltf = await loadGLTF('./models/rifle_awm_nc.glb');
      } catch (err) {
        gltf = await loadGLTF('./models/rifle.glb');
      }
      const model = gltf.scene;
      model.traverse((o) => {
        const m = /** @type {any} */ (o);
        if (m.isMesh && m.material) {
          m.material = m.material.clone();
          m.material.metalness = 0.3;
          m.material.roughness = 0.55;
        }
      });
      const size = measure(model).getSize(new THREE.Vector3());
      if (size.x >= size.z) model.rotation.y = Math.PI / 2;
      const wrap = new THREE.Group();
      wrap.add(model);
      wrap.scale.setScalar(0.92 / Math.max(size.x, size.y, size.z));
      const c = measure(wrap).getCenter(new THREE.Vector3());
      wrap.position.sub(c);
      wrap.position.z -= 0.3;
      holder.add(wrap);
    } catch (err) {
      console.warn('Rifle model did not load.', err);
    }
    return holder;
  }

  return {
    mission,
    crowd,
    portraitSource: { gltf: crowd.gltf, baseHeight: crowd.baseHeight, look: crowd.targetLook },
    /** Restarts the contract: the page reloads and starts playing straight away. */
    restart() {
      try {
        sessionStorage.setItem('skyline.autostart', '1');
      } catch (err) {
        /* storage blocked: the menu shows instead */
      }
      location.reload();
    },
    begin() {
      s = freshState();
      s.mode = 'playing';
      hud.reset();
      input.consumeLook();
      input.consumeGyro();
      input.setGyro(settings.gyro !== 'off');
      audio.startAmbient();
      hud.intel(mission.intel[0].text);
      s.intelIndex = 1;
    },
    pause() {
      if (s.mode !== 'playing') return false;
      s.mode = 'paused';
      s.holding = false;
      return true;
    },
    resume() {
      if (s.mode !== 'paused') return;
      s.mode = 'playing';
      input.consumeLook();
      last = performance.now();
    },
    get mode() {
      return s.mode;
    },
    applySettings(next) {
      settings = next;
      audio.setEnabled(next.sound);
      input.setGyro(next.gyro !== 'off');
      perf.checked = false;
      perf.frames = 0;
      perf.total = 0;
      applyQuality();
    },
    fire,
    reload: startReload,
    toggleScope,
    setBreath,
    setZoom,
    skipCinematic,
    zoomStep(steps) {
      setZoom(s.zoom * Math.pow(1.15, steps));
    },
    debug: {
      state: () => s,
      canFire,
      steady(on) {
        steady = on;
        if (on) s.swayMul = 0;
      },
      aimAt(x, y, z) {
        const dx = x - eye.x;
        const dy = y - eye.y;
        const dz = z - eye.z;
        s.yaw = Math.atan2(-dx, -dz);
        s.pitch = Math.atan2(dy, Math.hypot(dx, dz));
        s.recoil = 0;
      },
      /** Aims at the target's chest, leading him and holding over for drop and wind. */
      solveTarget(part) {
        const t = crowd.target;
        const y = t.root.position.y + (part === 'head' ? 0.935 : 0.68) * t.h;
        const flat = Math.hypot(t.x - eye.x, t.z - eye.z);
        const shot = shotAt(rifle, zero, flat, s.wind);
        const v = t.velocity();
        this.aimAt(t.x + v.x * shot.time - shot.drift, y + shot.drop, t.z + v.z * shot.time);
      }
    }
  };
}

/** A copper boat-tail bullet with a cannelure, tip pointing along +z, centred on its middle. */
function makeBullet() {
  const k = 4;
  const r = 0.0039 * k;
  const len = 0.032 * k;
  const profile = [
    [0, 0], [r * 0.82, 0], [r, len * 0.12], [r, len * 0.4], [r * 0.93, len * 0.43],
    [r, len * 0.46], [r, len * 0.55], [r * 0.72, len * 0.82], [r * 0.3, len * 0.97], [0, len]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 24);
  geo.translate(0, -len / 2, 0);
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#c6834f', metalness: 1, roughness: 0.28, envMapIntensity: 1.6 }));
  mesh.visible = false;
  return mesh;
}

/** Faint vapour trail behind the bullet. */
function makeTrail(scene) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(6);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  scene.add(line);
  let fade = 0;
  return {
    set(tail, head) {
      positions[0] = tail.x; positions[1] = tail.y; positions[2] = tail.z;
      positions[3] = head.x; positions[4] = head.y; positions[5] = head.z;
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 0.5;
      fade = 0.5;
    },
    update(dt) {
      if (fade > 0) {
        fade -= dt;
        mat.opacity = Math.max(0, fade);
      }
    }
  };
}

/** Dust and debris puffs at impacts. */
function makePuffs(scene) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const live = [];
  return {
    add(p, color, size) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false }));
      sp.position.set(p.x, p.y, p.z);
      sp.userData = { age: 0, size };
      sp.scale.setScalar(size * 0.2);
      scene.add(sp);
      live.push(sp);
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const sp = live[i];
        sp.userData.age += dt;
        const a = sp.userData.age / 1.2;
        if (a >= 1) {
          scene.remove(sp);
          sp.material.dispose();
          live.splice(i, 1);
          continue;
        }
        sp.scale.setScalar(sp.userData.size * (0.2 + a));
        sp.position.y += dt * 0.5;
        sp.material.opacity = 0.85 * (1 - a);
      }
    }
  };
}

function vibrate(ms) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch (err) {
    /* not supported */
  }
}
