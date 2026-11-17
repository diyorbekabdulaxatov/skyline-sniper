// @ts-check
// People on the plaza: walkers on routes, groups standing and talking, the contact at the
// fountain and the target. Each person is a skinned glTF clone with its own clothes colours
// and animation mixer. Hits use the BODY zones from ballistics.js, scaled to each height.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { personHit } from './ballistics.js';
import { loadGLTF, measure } from './assets.js';
import { LAYOUT } from './city.js';
import { rng } from './facades.js';

const PERSON_URL = './models/man-suit.glb';
const SUITS = ['#2b3442', '#4a4f57', '#1f2124', '#5c4a3a', '#3d4b3f', '#6b6f75', '#2e3a55', '#7b6a55', '#8a8f96'];
const TROUSERS = ['#1d1f22', '#2d3138', '#3b3f45', '#4b4236', '#23293a'];
const SKINS = ['#e0b49a', '#c68e6e', '#a46e4f', '#7a4b33', '#f1c9b0', '#b98262'];
const HAIR = ['#1a1410', '#3b2a1e', '#6b4c33', '#9a7b55', '#2b2b2b', '#8c8c8c'];

/**
 * @typedef {{ suit: string, trousers: string, skin: string, hair: string, tie?: string }} Look
 * @typedef {{ x: number, z: number, wait?: number }} Waypoint
 */

/** Finds the clip for a role, whatever the model calls it. */
function findClip(clips, role) {
  const tests = {
    walk: /walk/i,
    idle: /idle/i,
    run: /(^|[_|\s])run(ning)?$/i,
    death: /death|dying/i
  };
  return clips.find((c) => tests[role].test(c.name)) || null;
}

export class Person {
  /**
   * @param {any} gltf
   * @param {number} baseHeight height of the model as loaded
   * @param {Look} look
   * @param {number} height metres
   */
  constructor(gltf, baseHeight, look, height) {
    this.h = height;
    this.look = look;
    this.root = new THREE.Group();
    const model = SkeletonUtils.clone(gltf.scene);
    model.scale.multiplyScalar(height / baseHeight);
    const box = measure(model);
    model.position.x -= (box.min.x + box.max.x) / 2;
    model.position.y -= box.min.y;
    model.position.z -= (box.min.z + box.max.z) / 2;
    model.traverse((o) => {
      const mesh = /** @type {any} */ (o);
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      const recolor = (m) => {
        const c = m.clone();
        const name = (m.name || '').toLowerCase();
        if (name.includes('shirt')) c.color.set(look.suit);
        else if (name.includes('pants')) c.color.set(look.trousers);
        else if (name.includes('skin')) c.color.set(look.skin);
        else if (name.includes('hair')) c.color.set(look.hair);
        else if (name.includes('tie') && look.tie) c.color.set(look.tie);
        c.metalness = 0;
        c.roughness = 0.8;
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(recolor) : recolor(mesh.material);
    });
    this.model = model;
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    /** @type {Record<string, THREE.AnimationAction>} */
    this.actions = {};
    for (const role of ['walk', 'idle', 'run', 'death']) {
      const clip = findClip(gltf.animations, role);
      if (clip) this.actions[role] = this.mixer.clipAction(clip);
    }
    if (this.actions.death) {
      this.actions.death.setLoop(THREE.LoopOnce, 1);
      this.actions.death.clampWhenFinished = true;
    }
    /** @type {THREE.AnimationAction | null} */
    this.current = null;
    this.alive = true;
    /** 'walk' | 'idle' | 'flee' | 'dead' | 'gone' */
    this.mode = 'idle';
    /** @type {Waypoint[]} */
    this.path = [];
    this.index = 0;
    this.dir = 1;
    this.loop = true;
    this.speed = 1.3;
    this.wait = 0;
    this.panicDelay = 0;
    /** @type {(() => void) | null} */
    this.onArrive = null;
  }

  get x() {
    return this.root.position.x;
  }

  get z() {
    return this.root.position.z;
  }

  place(x, z, face) {
    this.root.position.set(x, LAYOUT.walkY, z);
    this.root.rotation.y = face || 0;
  }

  play(name, fade) {
    const next = this.actions[name] || this.actions.idle;
    if (!next || next === this.current) return;
    next.reset().fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
  }

  /**
   * @param {Waypoint[]} points
   * @param {{ loop?: boolean, speed?: number, start?: number, dir?: number }} [opts]
   */
  walk(points, opts = {}) {
    this.path = points;
    this.loop = opts.loop !== false;
    this.speed = opts.speed || this.speed;
    this.index = opts.start || 0;
    this.dir = opts.dir || 1;
    this.mode = 'walk';
    const p = points[this.index];
    if (p && this.root.position.lengthSq() === 0) this.place(p.x, p.z, 0);
  }

  standStill(face) {
    this.mode = 'idle';
    if (face !== undefined) this.root.rotation.y = face;
    this.play('idle', 0.3);
  }

  /** Runs for the nearest exit after a short, individual reaction delay. */
  flee(exits) {
    if (!this.alive || this.mode === 'gone') return;
    let best = exits[0];
    let bestD = Infinity;
    for (const e of exits) {
      const d = Math.hypot(e.x - this.x, e.z - this.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    this.path = [best];
    this.index = 0;
    this.loop = false;
    this.speed = 3.6 + Math.random() * 0.8;
    this.panicDelay = Math.random() * 0.7;
    this.mode = 'flee';
    this.onArrive = () => {
      this.mode = 'gone';
      this.root.visible = false;
    };
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.mode = 'dead';
    this.play('death', 0.08);
  }

  /** @param {number} dt */
  update(dt) {
    this.mixer.update(dt);
    if (this.mode === 'dead' || this.mode === 'gone' || this.mode === 'idle') return;
    if (this.panicDelay > 0) {
      this.panicDelay -= dt;
      return;
    }
    if (this.wait > 0) {
      this.wait -= dt;
      this.play('idle', 0.4);
      return;
    }
    const goal = this.path[this.index];
    if (!goal) return;
    const dx = goal.x - this.x;
    const dz = goal.z - this.z;
    const d = Math.hypot(dx, dz);
    const stepLen = this.speed * dt;
    const running = this.speed > 2.5;
    this.play(running ? 'run' : 'walk', 0.3);
    const a = this.actions[running ? 'run' : 'walk'];
    if (a) a.timeScale = running ? this.speed / 3.8 : this.speed / 1.3;
    if (d <= stepLen) {
      this.root.position.x = goal.x;
      this.root.position.z = goal.z;
      if (goal.wait) this.wait = goal.wait;
      const last = this.dir > 0 ? this.index === this.path.length - 1 : this.index === 0;
      if (last) {
        if (!this.loop) {
          this.mode = 'idle';
          this.play('idle', 0.4);
          const done = this.onArrive;
          this.onArrive = null;
          if (done) done();
          return;
        }
        this.index = this.dir > 0 ? 0 : this.path.length - 1;
      } else {
        this.index += this.dir;
      }
    } else {
      this.root.position.x += (dx / d) * stepLen;
      this.root.position.z += (dz / d) * stepLen;
      const want = Math.atan2(dx, dz);
      let diff = want - this.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.root.rotation.y += diff * Math.min(1, dt * 8);
    }
  }

  /** Current velocity estimate in m/s, for leading moving targets. */
  velocity() {
    if (this.mode !== 'walk' && this.mode !== 'flee') return { x: 0, z: 0 };
    if (this.wait > 0 || this.panicDelay > 0) return { x: 0, z: 0 };
    const goal = this.path[this.index];
    if (!goal) return { x: 0, z: 0 };
    const dx = goal.x - this.x;
    const dz = goal.z - this.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: (dx / d) * this.speed, z: (dz / d) * this.speed };
  }

  /**
   * Segment test in world space against this person's body zones.
   * @param {{x:number,y:number,z:number}} a
   * @param {{x:number,y:number,z:number}} b
   */
  hitTest(a, b) {
    if (!this.alive || this.mode === 'gone') return null;
    const px = this.x;
    const pz = this.z;
    // Cheap rejection: the segment is about a metre long.
    if (Math.abs(a.x - px) > 4 || Math.abs(a.z - pz) > 4) return null;
    const ang = -this.root.rotation.y;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const local = (p) => {
      const x = p.x - px;
      const z = p.z - pz;
      return { x: x * c + z * s, y: p.y - this.root.position.y, z: -x * s + z * c };
    };
    return personHit(local(a), local(b), this.h);
  }
}

/**
 * Builds everyone for the Harbor Plaza contract.
 * @param {THREE.Scene} scene
 */
export async function createCrowd(scene) {
  const gltf = await loadGLTF(PERSON_URL);
  const baseHeight = measure(gltf.scene).getSize(new THREE.Vector3()).y;
  const r = rng(77);
  const pick = (list) => list[Math.floor(r() * list.length)];
  /** @returns {Look} */
  const randomLook = () => ({ suit: pick(SUITS), trousers: pick(TROUSERS), skin: pick(SKINS), hair: pick(HAIR), tie: pick(['#2a3b5c', '#5b2a2a', '#3c3c3c', '#7d6a3a']) });
  const make = (look, height) => {
    const p = new Person(gltf, baseHeight, look, height);
    scene.add(p.root);
    return p;
  };

  /** @type {Person[]} */
  const civilians = [];
  const routes = [
    { pts: rect(-34, -32, 34, -98), loop: true },
    { pts: [{ x: -34, z: -32 }, { x: -15, z: -50 }, { x: -30, z: -98 }, { x: 30, z: -98 }, { x: 15, z: -74 }, { x: 34, z: -32 }], loop: true },
    { pts: ring(LAYOUT.fountain.x, LAYOUT.fountain.z, 14.5, 14), loop: true },
    { pts: [{ x: -120, z: -24 }, { x: 120, z: -24 }], loop: false },
    { pts: [{ x: -120, z: -106 }, { x: 120, z: -106 }], loop: false },
    { pts: [{ x: -120, z: -124 }, { x: 120, z: -124 }], loop: false },
    { pts: [{ x: -120, z: -4 }, { x: 120, z: -4 }], loop: false }
  ];
  for (let i = 0; i < 24; i++) {
    const route = routes[i % routes.length];
    const p = make(randomLook(), 1.68 + r() * 0.2);
    const start = Math.floor(r() * route.pts.length);
    const s = route.pts[start];
    const n = route.pts[(start + 1) % route.pts.length];
    const t = r();
    p.place(s.x + (n.x - s.x) * t, s.z + (n.z - s.z) * t, 0);
    p.walk(route.pts, { loop: true, speed: 1.1 + r() * 0.5, start: (start + 1) % route.pts.length, dir: 1 });
    // Straight sidewalk routes walk back and forth.
    if (!route.loop) {
      p.walk(route.pts, { loop: true, speed: 1.1 + r() * 0.5, start: r() < 0.5 ? 0 : 1, dir: 1 });
      p.place(-120 + r() * 240, route.pts[0].z, 0);
    }
    civilians.push(p);
  }
  // Groups standing and talking.
  for (const [x, z] of [[-20, -40], [22, -88], [-25, -90], [20, -38]]) {
    const a = make(randomLook(), 1.7 + r() * 0.15);
    const b = make(randomLook(), 1.7 + r() * 0.15);
    a.place(x - 0.6, z, Math.PI / 2);
    b.place(x + 0.6, z, -Math.PI / 2);
    a.standStill(Math.PI / 2);
    b.standStill(-Math.PI / 2);
    civilians.push(a, b);
  }

  // The contact waits by the fountain, facing north toward Meridian Tower.
  const contact = make({ suit: '#7b6a55', trousers: '#3b3f45', skin: '#c68e6e', hair: '#1a1410', tie: '#3c3c3c' }, 1.74);
  contact.place(6.5, -79, Math.PI);
  contact.standStill(Math.PI);
  civilians.push(contact);

  // The target: grey suit, red tie.
  const targetLook = { suit: '#6e7378', trousers: '#2d3138', skin: '#e0b49a', hair: '#3b2a1e', tie: '#b3261e' };
  const target = make(targetLook, 1.82);
  const door = LAYOUT.meridianDoor;
  target.place(door.x, door.z, 0);
  const car = LAYOUT.targetCar;
  target.walk([
    { x: door.x, z: door.z + 1 },
    { x: 9, z: -115 },
    { x: 8, z: -104.5 },
    { x: 6.5, z: -90 },
    { x: 5.2, z: -81, wait: 26 },
    { x: 11, z: -93 },
    { x: 18, z: -103 },
    { x: car.x - 2.4, z: -106.8 },
    { x: car.x - 2.4, z: car.z + 1.2 }
  ], { loop: false, speed: 1.25 });

  const exits = [
    { x: -60, z: -20 }, { x: 60, z: -20 }, { x: -60, z: -110 }, { x: 60, z: -110 },
    { x: -130, z: -24 }, { x: 130, z: -24 }, { x: -130, z: -106 }, { x: 130, z: -106 },
    { x: -130, z: -4 }, { x: 130, z: -4 }, { x: door.x, z: door.z }
  ];

  let panicked = false;
  const all = [...civilians, target];
  return {
    civilians,
    target,
    contact,
    targetLook,
    get panicked() {
      return panicked;
    },
    /** Everyone runs for cover; the target runs for his car. */
    panic() {
      if (panicked) return;
      panicked = true;
      for (const p of civilians) p.flee(exits);
      if (target.alive) {
        target.path = [{ x: 18, z: -103 }, { x: car.x - 2.4, z: car.z + 1.2 }];
        target.index = 0;
        target.loop = false;
        target.wait = 0;
        target.speed = 4.6;
        target.mode = 'walk';
        target.panicDelay = 0.35;
      }
    },
    /** @param {number} dt */
    update(dt) {
      for (const p of all) p.update(dt);
    },
    /**
     * Earliest person hit by the segment a-b.
     * @returns {{ t: number, part: 'head' | 'body', person: Person } | null}
     */
    hitTest(a, b) {
      let best = null;
      for (const p of all) {
        const h = p.hitTest(a, b);
        if (h && (!best || h.t < best.t)) best = { t: h.t, part: h.part, person: p };
      }
      return best;
    },
    gltf,
    baseHeight
  };
}

function rect(x0, z0, x1, z1) {
  return [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
}

function ring(cx, cz, radius, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * radius, z: cz + Math.sin(a) * radius });
  }
  return pts;
}

/**
 * Renders a briefing photo of the target into a canvas: head and shoulders, studio light.
 * @param {HTMLCanvasElement} canvas
 * @param {any} gltf
 * @param {number} baseHeight
 * @param {Look} look
 */
export function renderPortrait(canvas, gltf, baseHeight, look) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  } catch (err) {
    return;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(canvas.clientWidth || 160, canvas.clientHeight || 200, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d9dde2');
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b6e73', 1.6));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(1.5, 2.5, 3);
  scene.add(key);
  const p = new Person(gltf, baseHeight, look, 1.82);
  p.play('idle', 0);
  p.mixer.update(0.5);
  p.root.rotation.y = 0.25;
  scene.add(p.root);
  const cam = new THREE.PerspectiveCamera(24, (canvas.clientWidth || 160) / (canvas.clientHeight || 200), 0.1, 20);
  cam.position.set(0.2, 1.58, 2.2);
  cam.lookAt(0, 1.52, 0);
  renderer.render(scene, cam);
  renderer.dispose();
}
