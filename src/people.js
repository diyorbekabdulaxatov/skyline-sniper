// @ts-check
// People on the plaza: walkers on routes, groups talking, people on their phones, the contact
// at the fountain and the target. Everyone is a Microsoft Rocketbox avatar (MIT) animated with
// Rocketbox clips converted in CI (scripts/fetch-animations.mjs). If those files are missing,
// the crowd falls back to the CC0 Quaternius person so the game still runs.
// Hits use the BODY zones from ballistics.js, scaled to each person's height.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { personHit } from './ballistics.js';
import { loadGLTF, measure, loadAnimationSet } from './assets.js';
import { LAYOUT } from './city.js';
import { rng } from './facades.js';
import { dressWorkwear } from './workwear.js';

const FALLBACK_URL = './models/man-suit.glb';
const PEOPLE_DIR = './models/people/';
/** The target's avatar: checked brown-grey suit, dark red shirt. Nobody else wears it. */
const TARGET_AVATAR = 'Male_Adult_03';
const CONTACT_AVATAR = 'Male_Adult_05';
const MEN = ['Male_Adult_04', 'Male_Adult_05', 'Male_Adult_07', 'Male_Adult_10', 'Male_Adult_11', 'Male_Adult_12', 'Male_Adult_17', 'Male_Adult_20'];
const WOMEN = ['Female_Adult_02', 'Female_Adult_11'];
const ROLES = ['walk', 'run', 'idle', 'idle2', 'phone', 'talk'];

// Outfit colours for the fallback person only (Rocketbox avatars keep their own clothes).
const SUITS = ['#2b3442', '#4a4f57', '#1f2124', '#5c4a3a', '#3d4b3f', '#6b6f75', '#2e3a55', '#7b6a55', '#8a8f96'];
const TROUSERS = ['#1d1f22', '#2d3138', '#3b3f45', '#4b4236', '#23293a'];
const SKINS = ['#e0b49a', '#c68e6e', '#a46e4f', '#7a4b33', '#f1c9b0', '#b98262'];
const HAIR = ['#1a1410', '#3b2a1e', '#6b4c33', '#9a7b55', '#2b2b2b', '#8c8c8c'];

/**
 * Optional site workwear (workwear.js): a hard hat and hi-vis vest colour, and a colour the
 * avatar's own clothes are recoloured toward (a coat that sets one person apart).
 * @typedef {{ suit: string, trousers: string, skin: string, hair: string, tie?: string, avatar?: string,
 *   hat?: string, vest?: string, coat?: string }} Look
 * @typedef {{ x: number, z: number, wait?: number, anim?: string }} Waypoint
 * @typedef {{ clip: THREE.AnimationClip, speed: number }} RoleClip
 * @typedef {{ kind: 'rocketbox' | 'fallback', id: string, female: boolean, gltf: any,
 *   baseHeight: number, clips: Record<string, RoleClip> }} Base
 */

/** Finds a clip in the fallback model for a role, whatever it is called. */
function findClip(clips, role) {
  /** @type {Record<string, RegExp>} */
  const tests = { walk: /walk/i, idle: /idle/i, run: /(^|[_|\s])run(ning)?$/i, death: /death|dying/i };
  return tests[role] ? clips.find((c) => tests[role].test(c.name)) || null : null;
}

/**
 * Turns converted Rocketbox data into clips for one avatar. The tracks are local bone
 * rotations in the Biped's own frames, which the avatars share; the hip bob is added to this
 * avatar's own hip position so the feet stay on the ground.
 * @param {any} gltf
 * @param {Record<string, import('./assets.js').AnimData>} anims
 * @param {string} prefix 'm_' or 'f_'
 * @returns {Record<string, RoleClip>}
 */
function buildClips(gltf, anims, prefix) {
  /** @type {Record<string, THREE.Object3D>} */
  const bones = {};
  gltf.scene.traverse((o) => {
    if (o.name && o.name.startsWith('Bip01')) bones[o.name] = o;
  });
  const hips = bones.Bip01;
  /** @type {Record<string, RoleClip>} */
  const out = {};
  for (const role of ROLES) {
    const a = anims[prefix + role];
    if (!a) continue;
    const times = [];
    for (let i = 0; i < a.frames; i++) times.push(Math.min(a.duration, i / a.fps));
    const tracks = [];
    for (const bone of Object.keys(a.tracks)) {
      if (!bones[bone]) continue;
      const values = a.tracks[bone];
      tracks.push(values.length === 4
        ? new THREE.QuaternionKeyframeTrack(bone + '.quaternion', [0], values)
        : new THREE.QuaternionKeyframeTrack(bone + '.quaternion', times, values));
    }
    if (a.bob && hips) {
      const p = hips.position;
      const values = [];
      for (let i = 0; i < a.frames; i++) values.push(p.x, p.y + a.bob[i], p.z);
      tracks.push(new THREE.VectorKeyframeTrack(hips.name + '.position', times, values));
    }
    out[role] = { clip: new THREE.AnimationClip(prefix + role, a.duration, tracks), speed: a.speed };
  }
  return out;
}

/** Rocketbox materials ship slightly metallic; our scene is lit by sky and sun, so keep them matte. */
function matte(gltf) {
  gltf.scene.traverse((o) => {
    const mesh = /** @type {any} */ (o);
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!m) continue;
      if ('metalness' in m) m.metalness = 0;
      if ('roughness' in m) m.roughness = Math.max(0.6, m.roughness);
      if ('envMapIntensity' in m) m.envMapIntensity = 0.7;
    }
  });
}

/**
 * Loads all Rocketbox avatars with their clips, or returns null if anything is missing.
 * @returns {Promise<Record<string, Base> | null>}
 */
async function loadRocketbox() {
  const anims = await loadAnimationSet();
  if (!anims || !anims.m_walk || !anims.f_walk) return null;
  const ids = [TARGET_AVATAR, ...MEN, ...WOMEN];
  try {
    const list = await Promise.all(ids.map((id) => loadGLTF(PEOPLE_DIR + id + '.glb')));
    /** @type {Record<string, Base>} */
    const bases = {};
    ids.forEach((id, i) => {
      const gltf = list[i];
      matte(gltf);
      const female = id.startsWith('Female');
      bases[id] = {
        kind: 'rocketbox',
        id,
        female,
        gltf,
        baseHeight: measure(gltf.scene).getSize(new THREE.Vector3()).y,
        clips: buildClips(gltf, anims, female ? 'f_' : 'm_')
      };
    });
    return bases;
  } catch (err) {
    console.warn('Rocketbox people did not load; using the placeholder person.', err);
    return null;
  }
}

/** @returns {Promise<Base>} */
async function loadFallback() {
  const gltf = await loadGLTF(FALLBACK_URL);
  /** @type {Record<string, RoleClip>} */
  const clips = {};
  for (const role of ['walk', 'idle', 'run', 'death']) {
    const clip = findClip(gltf.animations, role);
    if (clip) clips[role] = { clip, speed: role === 'run' ? 3.8 : 1.3 };
  }
  return { kind: 'fallback', id: 'man-suit', female: false, gltf, baseHeight: measure(gltf.scene).getSize(new THREE.Vector3()).y, clips };
}

/** Where shots come from (the current mission's eye); bodies fall away from it. */
const shooter = { x: LAYOUT.eye.x, z: LAYOUT.eye.z };

/** @param {{ x: number, z: number }} eye */
export function setShooter(eye) {
  shooter.x = eye.x;
  shooter.z = eye.z;
}

export class Person {
  /**
   * @param {Base} base
   * @param {Look} look
   * @param {number} height metres
   */
  constructor(base, look, height) {
    this.base = base;
    this.h = height;
    this.look = look;
    this.root = new THREE.Group();
    const model = SkeletonUtils.clone(base.gltf.scene);
    model.scale.multiplyScalar(height / base.baseHeight);
    const box = measure(model);
    model.position.x -= (box.min.x + box.max.x) / 2;
    model.position.y -= box.min.y;
    model.position.z -= (box.min.z + box.max.z) / 2;
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
    model.traverse((o) => {
      const mesh = /** @type {any} */ (o);
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      if (base.kind === 'fallback') {
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(recolor) : recolor(mesh.material);
      }
    });
    this.model = model;
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    /** @type {Record<string, THREE.AnimationAction>} */
    this.actions = {};
    for (const role of Object.keys(base.clips)) this.actions[role] = this.mixer.clipAction(base.clips[role].clip);
    if (this.actions.death) {
      this.actions.death.setLoop(THREE.LoopOnce, 1);
      this.actions.death.clampWhenFinished = true;
    }
    /** Which clip "idle" means for this person: 'idle', 'idle2', 'phone' or 'talk'. */
    this.idleRole = 'idle';
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
    /** @type {any} Procedural fall state after a fatal hit. */
    this.fall = null;
    /** Ground height under this person, set by place(). */
    this.groundY = LAYOUT.walkY;
    dressWorkwear(this, look);
  }

  get x() {
    return this.root.position.x;
  }

  get z() {
    return this.root.position.z;
  }

  /**
   * @param {number} x @param {number} z @param {number} [face]
   * @param {number} [y] ground height here (pavement by default; rooftops and piers differ)
   */
  place(x, z, face, y) {
    this.groundY = y === undefined ? LAYOUT.walkY : y;
    this.root.position.set(x, this.groundY, z);
    this.root.rotation.y = face || 0;
  }

  /** Plays a role ('walk', 'run', 'idle', 'phone', 'talk', ...), cross-fading from the last one. */
  play(name, fade) {
    const role = name === 'idle' ? this.idleRole : name;
    const next = this.actions[role] || this.actions[name] || this.actions.idle || this.actions.walk;
    if (!next || next === this.current) return;
    next.reset();
    // Start looping clips at a random point so neighbours do not move in step.
    if (next.loop !== THREE.LoopOnce) next.time = Math.random() * next.getClip().duration;
    next.fadeIn(fade).play();
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

  /** Stands in place doing `role` (idle, idle2, phone or talk), turned to `face`. */
  standStill(face, role) {
    this.mode = 'idle';
    if (role) this.idleRole = role;
    if (face !== undefined) this.root.rotation.y = face;
    this.play('idle', 0.4);
  }

  /** Changes what a standing person does without moving them. */
  setIdle(role) {
    if (this.idleRole === role) return;
    this.idleRole = role;
    if (this.mode === 'idle' || this.wait > 0) this.play('idle', 0.5);
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
    this.wait = 0;
    this.speed = 3.4 + Math.random() * 0.8;
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
    if (this.actions.death) {
      this.play('death', 0.08);
      return;
    }
    // Rocketbox has no death clip: freeze the current pose and fall procedurally,
    // away from the shooter, with the knees giving way first.
    for (const a of Object.values(this.actions)) a.paused = true;
    const dx = this.x - shooter.x;
    const dz = this.z - shooter.z;
    const d = Math.hypot(dx, dz) || 1;
    /** @type {Record<string, THREE.Object3D>} */
    const bones = {};
    this.model.traverse((o) => {
      if (o.name && o.name.startsWith('Bip01')) bones[o.name] = o;
    });
    const side = (Math.random() - 0.5) * 0.7;
    this.fall = {
      t: 0,
      axis: new THREE.Vector3(dz / d + side * (-dx / d), 0, -dx / d + side * (-dz / d)).normalize(),
      yaw: this.root.quaternion.clone(),
      bones,
      spin: (Math.random() - 0.5) * 0.5,
      lead: Math.random() < 0.5 ? 'L' : 'R',
      // The pose at the moment of the hit; every frame starts again from it, so bends never pile up.
      base: Object.fromEntries(Object.entries(bones).map(([n, b]) => [n, b.quaternion.clone()]))
    };
  }

  /**
   * Procedural death, in three overlapping phases:
   *   0.00-0.30 s  knees give way: thighs swing forward, shins fold back, hips drop;
   *   0.15-0.95 s  the body topples away from the shooter around the feet, gathering speed;
   *   after        a small bounce as it lands, then it lies still.
   * Bones are bent about axes taken from the body's own right-hand direction in world space,
   * so the bends go the right way whatever each bone's local frame is.
   */
  updateFall(dt) {
    const f = this.fall;
    f.t += dt;
    for (const name of Object.keys(f.base)) f.bones[name].quaternion.copy(f.base[name]);
    const ease = (x) => x * x * (3 - 2 * x);
    const buckle = ease(Math.min(1, f.t / 0.3));
    const topple = Math.max(0, Math.min(1, (f.t - 0.15) / 0.8));
    const after = Math.max(0, f.t - 0.95);
    const bounce = after > 0 ? Math.sin(after * 12) * Math.exp(-after * 6) * 0.05 : 0;
    const angle = Math.pow(topple, 2.2) * (Math.PI / 2 - 0.08) - Math.abs(bounce);
    const tip = new THREE.Quaternion().setFromAxisAngle(f.axis, angle);
    const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.spin * topple);
    this.root.quaternion.copy(tip).multiply(twist).multiply(f.yaw);
    // Hips sink as the knees go, then the body lies on the ground rather than inside it.
    const sink = 0.16 * this.h * buckle * (1 - topple);
    this.root.position.y = this.groundY - sink + Math.sin(angle) * 0.1 * this.h;

    // The body's right-hand direction in the world, now (it turns as the body tips).
    this.root.updateMatrixWorld(true);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.root.quaternion).normalize();
    const parentQ = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    // Rotates a bone by `amount` radians about the world axis `worldAxis`.
    const bend = (name, worldAxis, amount) => {
      const b = f.bones[name];
      if (!b || !b.parent || !amount) return;
      b.parent.updateWorldMatrix(true, false);
      b.parent.getWorldQuaternion(parentQ);
      axis.copy(worldAxis).applyQuaternion(parentQ.invert());
      b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, amount));
    };
    // About `right`, positive turns a hanging limb backward and an upright spine forward.
    for (const side of ['L', 'R']) {
      const k = side === f.lead ? 1 : 0.8;
      bend('Bip01_' + side + '_Thigh', right, -0.4 * buckle * k);
      bend('Bip01_' + side + '_Calf', right, 0.85 * buckle * k);
      bend('Bip01_' + side + '_UpperArm', right, -0.45 * topple);
    }
    bend('Bip01_Spine1', right, 0.18 * buckle);
    bend('Bip01_Neck', right, 0.2 * buckle - 0.3 * topple);
  }

  /**
   * @param {number} dt
   * @param {boolean} [onScreen] false while the person is outside the view: the skeleton is then
   *   animated only a few times a second (nobody sees it), which saves a lot of phone power.
   */
  update(dt, onScreen) {
    // While falling the animation stays frozen at the hit; the fall poses the bones itself.
    if (this.fall) {
      this.updateFall(dt);
      return;
    }
    this.animDebt = (this.animDebt || 0) + dt;
    if (onScreen !== false || this.animDebt > 0.25) {
      this.mixer.update(this.animDebt);
      this.animDebt = 0;
    }
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
    const role = running ? 'run' : 'walk';
    this.play(role, 0.3);
    const a = this.actions[role];
    const clip = this.base.clips[role];
    if (a && clip && clip.speed > 0) a.timeScale = this.speed / clip.speed;
    if (d <= stepLen) {
      this.root.position.x = goal.x;
      this.root.position.z = goal.z;
      if (goal.wait) {
        this.wait = goal.wait;
        if (goal.anim) this.idleRole = goal.anim;
      }
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
/**
 * What a scene's people setup gets to work with.
 * @typedef {{
 *   r: () => number, pick: (list: any[]) => any, rocketbox: Record<string, Base> | null,
 *   avatar: (id: string) => Base, passerby: (opts?: { female?: boolean }) => Person,
 *   make: (base: Base, look: Look, height: number) => Person, randomLook: () => Look,
 *   MEN: string[], WOMEN: string[], rect: typeof rect, ring: typeof ring
 * }} CrowdKit
 * What a scene's people setup returns.
 * @typedef {{
 *   civilians: Person[], target: Person, targetLook: Look & { avatar?: string },
 *   exits: { x: number, z: number }[],
 *   panicTarget?: (target: Person) => void, update?: (dt: number) => void,
 *   escaped: () => boolean, contact?: Person | null
 * }} CrowdSetup
 */

/**
 * Builds the people of a mission: loads the avatars and animations once (cached), then runs
 * the scene's setup, which places walkers, groups, the contact and the target.
 * @param {THREE.Scene} scene
 * @param {(kit: CrowdKit) => CrowdSetup} setup
 * @param {{ x: number, z: number }} eye the shooter's position, so bodies fall away from it
 * @param {number} seed
 */
export async function createCrowd(scene, setup, eye, seed) {
  setShooter(eye);
  const rocketbox = await loadRocketbox();
  const fallback = rocketbox ? null : await loadFallback();
  const r = rng(seed || 77);
  const pick = (list) => list[Math.floor(r() * list.length)];
  /** @returns {Look} */
  const randomLook = () => ({ suit: pick(SUITS), trousers: pick(TROUSERS), skin: pick(SKINS), hair: pick(HAIR), tie: pick(['#2a3b5c', '#5b2a2a', '#3c3c3c', '#7d6a3a']) });
  const avatar = (id) => (rocketbox && rocketbox[id]) || fallback || rocketbox[MEN[0]];
  const make = (base, look, height) => {
    const p = new Person(base, look, height);
    scene.add(p.root);
    return p;
  };
  /** A random passer-by: about one in four is a woman unless asked. */
  const passerby = (opts = {}) => {
    const female = opts.female !== undefined ? opts.female : r() < 0.27;
    const base = rocketbox ? rocketbox[pick(female ? WOMEN : MEN)] : fallback;
    return make(base, randomLook(), female ? 1.6 + r() * 0.12 : 1.7 + r() * 0.17);
  };
  const built = setup({ r, pick, rocketbox, avatar, passerby, make, randomLook, MEN, WOMEN, rect, ring });
  const { civilians, target, targetLook, exits } = built;
  const targetBase = avatar(targetLook.avatar || TARGET_AVATAR);

  let panicked = false;
  const all = [...civilians, target];
  const sphere = new THREE.Sphere();
  return {
    civilians,
    target,
    contact: built.contact || null,
    targetLook,
    get panicked() {
      return panicked;
    },
    /** Everyone runs for cover; the target runs for his escape route. */
    panic() {
      if (panicked) return;
      panicked = true;
      for (const p of civilians) p.flee(exits);
      if (target.alive && built.panicTarget) built.panicTarget(target);
    },
    /** True once the target has got away (the scene decides what that means). */
    escaped() {
      return target.alive && built.escaped();
    },
    /** @param {number} dt */
    /**
     * @param {number} dt
     * @param {THREE.Frustum} [frustum] the camera's view; people outside it are not drawn and
     *   animate at a low rate (they still walk, so they are where they should be when seen)
     */
    update(dt, frustum) {
      if (built.update) built.update(dt);
      for (const p of all) {
        let onScreen = true;
        if (frustum && p.mode !== 'gone') {
          sphere.center.set(p.x, p.root.position.y + p.h * 0.5, p.z);
          sphere.radius = p.h * 0.8;
          onScreen = frustum.intersectsSphere(sphere);
          p.root.visible = onScreen;
        }
        p.update(dt, onScreen);
      }
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
    /** For the briefing photo: the target's model (a Base) and its height. */
    gltf: targetBase,
    baseHeight: targetBase.baseHeight
  };
}

export { TARGET_AVATAR, CONTACT_AVATAR };

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
 * @param {any} base the crowd's `gltf` (a Base), or a raw glTF for the fallback person
 * @param {number} baseHeight
 * @param {Look} look
 */
export function renderPortrait(canvas, base, baseHeight, look) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  } catch (err) {
    return;
  }
  /** @type {Base} */
  const b = base && base.kind ? base : { kind: 'fallback', id: 'man-suit', female: false, gltf: base, baseHeight, clips: {} };
  const w = canvas.clientWidth || 160;
  const h = canvas.clientHeight || 200;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d9dde2');
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b6e73', 1.8));
  const key = new THREE.DirectionalLight('#ffffff', 2.6);
  key.position.set(1.5, 2.5, 3);
  scene.add(key);
  const p = new Person(b, look, 1.82);
  p.idleRole = 'idle';
  p.play('idle', 0);
  p.mixer.update(0.8);
  p.root.rotation.y = 0.25;
  scene.add(p.root);
  const cam = new THREE.PerspectiveCamera(22, w / h, 0.1, 20);
  cam.position.set(0.2, 1.6, 2.3);
  cam.lookAt(0, 1.55, 0);
  renderer.render(scene, cam);
  renderer.dispose();
}
