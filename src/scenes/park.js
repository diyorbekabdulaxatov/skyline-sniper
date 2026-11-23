// @ts-check
// Contract 07, Park Run (Riverside Park, 19:10, sunset). The network's enforcer, Dorian Kast,
// jogs his evening loop with one bodyguard: south along the river promenade, a stretch at the
// fitness bar by the river, then across the open lawn to the west gate, where a black sedan waits.
// The moving-target contract: he runs at 3 m/s for most of the route, so the shot must lead him.
//
// Layout (x east, z south, metres). The shooter stands on the roof of the corner block south-west
// of the park (x 20..38, z 256..282, roof at y = 26) and looks north-east over it. The lawn is
// x 50..142, z 62..250; the promenade (city.js) runs x 142..162 along the quay; the west street
// with the waiting car is x 38..50. Only what that roof can see is built: lawns, paths, trees,
// benches, lamps, the kiosk, the fitness corner, the fences and gates, the car, a few facades
// across the streets and a far shore across the water.
//
// Line of fire: every route point Kast runs through is 110-180 m from the eye, and the trees are
// planted by a test against the sight lines to the whole route (blocksView), so nothing stands
// in front of him. The kiosk and benches are placed clear of those lines; see the notes there.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGLTF, loadManifest, loadGroundMaterial } from '../assets.js';
import { bakeByMaterial, normalise, instanced, place } from '../instancing.js';
import { loadPack, placePart, fitScale, solidOf, instancePart } from '../sketchfab.js';
import { facadeMaterial, buildingGeometry, rng } from '../facades.js';
import { Person } from '../people.js';
import { LAYOUT } from '../city.js';

const SF = './game-assets/sketchfab/';
const WALK_Y = LAYOUT.walkY;

/** The park's fixed layout, shared by the people and the set dressing. */
export const PARK = {
  eye: { x: 37, y: 27.7, z: 257 },
  roof: { x0: 20, x1: 38, z0: 256, z1: 282, y: 26 },
  lawn: { x0: 50, x1: 142, z0: 62, z1: 250 },
  /** West gate in the fence at x = 50, and the car waiting on the west street. */
  gate: { x: 50, z0: 126.2, z1: 131 },
  car: { x: 43.6, z: 128.6 },
  door: { x: 45.5, z: 128.6 },
  /** Where Kast stops to stretch, in front of the fitness bar. */
  stretch: { x: 134, z: 186 },
  southGate: { x0: 96.6, x1: 100.4, z: 250 }
};

/** Kast's evening loop: south along the river, the fitness bar, the lawn, the gate, the car. */
const RUN_SPEED = 3.0;
const STRETCH_TIME = 18;
const ROUTE = [
  { x: 150, z: 66 },
  { x: 150, z: 196 },
  { x: PARK.stretch.x, z: PARK.stretch.z, wait: STRETCH_TIME, anim: 'idle' },
  { x: 100, z: 160 },
  { x: 70, z: 140 },
  { x: 50.5, z: 128.6 },
  { x: PARK.door.x, z: PARK.door.z }
];

/** Park paths (centre lines and widths), paved with the city's pavement texture. */
const PATHS = [
  { pts: [[142, 191.1], [134, 186], [100, 160], [70, 140], [50, 128.6]], w: 3.2 },
  { pts: [[98.5, 250], [100, 160]], w: 3 },
  { pts: [[99.5, 223], [110.6, 223]], w: 2.4 },
  { pts: [[62, 76], [122, 76], [122, 116], [62, 116], [62, 76]], w: 3 },
  { pts: [[70, 140], [70, 116]], w: 2.6 },
  { pts: [[122, 96], [142, 96]], w: 2.6 }
];

/** Avatars: Kast and his guard are unique in this contract. */
const TARGET_AVATAR = 'Male_Adult_10';
const GUARD_AVATAR = 'Male_Adult_07';
const MEN = ['Male_Adult_04', 'Male_Adult_05', 'Male_Adult_11', 'Male_Adult_12', 'Male_Adult_17', 'Male_Adult_20'];
const WOMEN = ['Female_Adult_02', 'Female_Adult_11'];
/** Other runners' kit: no red tops, so Kast's hoodie stays unique. */
const TOPS = ['#1f5fb4', '#f0f0ee', '#2e8b57', '#ff8c1a', '#5b3f8c', '#1c1c1e', '#f2d21b', '#2bb3c0'];
const BOTTOMS = ['#18191b', '#27344d', '#4a4d52', '#1d2a22'];
const SHOES = ['#f2f2f0', '#1c1c1c', '#3a6fd8', '#d8d8d8'];

const KAST_LOOK = {
  suit: '#c4161c', trousers: '#111214', skin: '#d9a98c', hair: '#1f1712', avatar: TARGET_AVATAR,
  outfit: { top: '#c4161c', bottom: '#111214', shoes: '#f4f4f2' }
};
const GUARD_LOOK = {
  suit: '#77797c', trousers: '#4d4f52', skin: '#b98262', hair: '#1a1410',
  outfit: { top: '#7a7c80', bottom: '#55575b', shoes: '#2a2a2a' }
};

// ---------- sight lines ----------

/** Flat unit vector from the eye toward (x, z). */
function losAt(x, z) {
  const dx = x - PARK.eye.x;
  const dz = z - PARK.eye.z;
  const d = Math.hypot(dx, dz) || 1;
  return { x: dx / d, z: dz / d };
}

/** Points along Kast's route (every 2 m) at chest and head height, for the tree test. */
const SIGHT_POINTS = (() => {
  /** @type {{ x: number, z: number }[]} */
  const pts = [];
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const a = ROUTE[i];
    const b = ROUTE[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2));
    for (let k = 0; k <= n; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return pts;
})();

/**
 * Whether a tree (a cylinder of `radius` from the ground to `top`) at (x, z) hides any point of
 * Kast's route from the eye: the sight line passes within the radius below the crown's top.
 */
export function blocksView(x, z, radius, top) {
  const e = PARK.eye;
  for (const q of SIGHT_POINTS) {
    for (const y of [1.25, 1.7]) {
      const dx = q.x - e.x;
      const dz = q.z - e.z;
      const len2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - e.x) * dx + (z - e.z) * dz) / len2));
      const px = e.x + dx * t;
      const pz = e.z + dz * t;
      if (Math.hypot(x - px, z - pz) > radius) continue;
      const h = e.y + (y - e.y) * t;
      if (h < top) return true;
    }
  }
  return false;
}

// ---------- posed people: cyclists and people sitting on benches ----------

/**
 * Freezes a person in a frame of the idle clip and stops the mixer, so bones can be bent by hand
 * (Rocketbox has no cycling or sitting clips). Returns the bones and that base pose.
 * @param {Person} p
 */
function rigOf(p) {
  /** @type {Record<string, THREE.Object3D>} */
  const bones = {};
  p.model.traverse((o) => {
    if (o.name && o.name.startsWith('Bip01')) bones[o.name] = o;
  });
  /** @type {Record<string, THREE.Quaternion>} */
  const base = {};
  if (!Object.keys(bones).length) return null;
  p.play('idle', 0.01);
  p.mixer.update(0.2);
  for (const n of Object.keys(bones)) base[n] = bones[n].quaternion.clone();
  p.mixer.stopAllAction();
  p.current = null;
  return { bones, base };
}

const AXIS = new THREE.Vector3();
const SIDE = new THREE.Vector3();
const PQ = new THREE.Quaternion();
const RQ = new THREE.Quaternion();

/**
 * Restores the base pose, then bends bones about the body's side axis (as Person.updateFall
 * does): positive turns a hanging limb backward and an upright spine forward.
 * @param {Person} p
 * @param {{ bones: Record<string, THREE.Object3D>, base: Record<string, THREE.Quaternion> } | null} rig
 * @param {[string, number][]} bends
 */
function pose(p, rig, bends) {
  if (!rig) return;
  for (const n of Object.keys(rig.base)) rig.bones[n].quaternion.copy(rig.base[n]);
  p.root.updateMatrixWorld(true);
  SIDE.set(1, 0, 0).applyQuaternion(p.root.quaternion).normalize();
  for (const [name, amount] of bends) {
    const b = rig.bones[name];
    if (!b || !b.parent || !amount) continue;
    b.parent.updateWorldMatrix(true, false);
    b.parent.getWorldQuaternion(PQ);
    AXIS.copy(SIDE).applyQuaternion(PQ.invert());
    b.quaternion.premultiply(RQ.setFromAxisAngle(AXIS, amount));
  }
}

/** Cycling pose at crank angle `phase`: leaning on the bars, legs turning the pedals. */
function ridePose(phase) {
  const s = Math.sin(phase);
  /** @type {[string, number][]} */
  const bends = [
    ['Bip01_Spine1', 0.3],
    ['Bip01_Neck', -0.24],
    ['Bip01_L_UpperArm', -0.55],
    ['Bip01_R_UpperArm', -0.55],
    ['Bip01_L_Forearm', -0.35],
    ['Bip01_R_Forearm', -0.35],
    ['Bip01_L_Thigh', -(0.85 + 0.42 * s)],
    ['Bip01_R_Thigh', -(0.85 - 0.42 * s)],
    ['Bip01_L_Calf', 1.2 + 0.6 * s],
    ['Bip01_R_Calf', 1.2 - 0.6 * s]
  ];
  return bends;
}

/** @type {[string, number][]} */
const SIT_POSE = [
  ['Bip01_Spine1', -0.06],
  ['Bip01_L_Thigh', -1.45],
  ['Bip01_R_Thigh', -1.38],
  ['Bip01_L_Calf', 1.45],
  ['Bip01_R_Calf', 1.32],
  ['Bip01_L_UpperArm', -0.3],
  ['Bip01_R_UpperArm', -0.25],
  ['Bip01_L_Forearm', -1.0],
  ['Bip01_R_Forearm', -0.95]
];

// ---------- bikes and dogs (Sketchfab, loaded once) ----------

/** @type {Promise<any> | null} */
let extrasPromise = null;

/** The bicycle (baked, 1.85 m long, front toward +z) and the animated dog, or nulls. */
function loadExtras() {
  if (!extrasPromise) {
    extrasPromise = Promise.all([
      loadGLTF(SF + 'bicycle.glb').catch(() => null),
      loadGLTF(SF + 'dog_retriever.glb').catch(() => null)
    ]).then(([bikeGltf, dogGltf]) => {
      /** @type {any} */
      let bike = null;
      if (bikeGltf) {
        bike = bakeByMaterial(bikeGltf.scene);
        normalise(bike, { length: 1.85 });
      }
      /** @type {any} */
      let dog = null;
      if (dogGltf) {
        const proto = dogGltf.scene;
        proto.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(proto, true);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const long = Math.max(size.x, size.z) || 1;
        // Which way the dog faces: its head bone's side of the body (front is +z by default).
        let yaw = size.x > size.z ? -Math.PI / 2 : 0;
        proto.traverse((o) => {
          if (/head/i.test(o.name) && !/top|end/i.test(o.name)) {
            const p = o.getWorldPosition(new THREE.Vector3());
            if (size.x > size.z) yaw = p.x > centre.x ? -Math.PI / 2 : Math.PI / 2;
            else yaw = p.z >= centre.z ? 0 : Math.PI;
          }
        });
        const src = dogGltf.animations && dogGltf.animations[0];
        // Root motion would drag the dog away from its owner: keep rotations only.
        const clip = src ? new THREE.AnimationClip('dog', src.duration, src.tracks.filter((t) => !/\.(position|scale)$/.test(t.name))) : null;
        dog = { proto, clip, scale: 1.15 / long, centre, minY: box.min.y, yaw };
      }
      return { bike, dog };
    }).catch((err) => {
      console.warn('Park bikes and dogs did not load.', err);
      return { bike: null, dog: null };
    });
  }
  return extrasPromise;
}

/** Bikes and dogs of the current crowd, removed when the crowd is rebuilt. */
/** @type {THREE.Group | null} */
let extras = null;
let crowdToken = 0;
/** @type {THREE.Object3D | null} The waiting car, driven away on escape. */
let carObj = null;
/** @type {Person | null} */
let escort = null;

function clearExtras() {
  if (extras && extras.parent) extras.parent.remove(extras);
  extras = null;
}

/**
 * @param {import('../people.js').CrowdKit} kit
 * @returns {import('../people.js').CrowdSetup}
 */
export function parkPeople(kit) {
  const { r, pick, make, avatar, randomLook } = kit;
  const token = ++crowdToken;
  clearExtras();
  /** @type {Person[]} */
  const civilians = [];
  const height = (female) => (female ? 1.6 + r() * 0.12 : 1.72 + r() * 0.16);
  const walker = (female) => make(avatar(female ? pick(WOMEN) : pick(MEN)), randomLook(), height(female));
  const runner = (female) => {
    const look = randomLook();
    look.outfit = { top: pick(TOPS), bottom: pick(BOTTOMS), shoes: pick(SHOES) };
    return make(avatar(female ? pick(WOMEN) : pick(MEN)), look, height(female));
  };
  /** Starts someone somewhere along a closed loop. */
  const onLoop = (p, pts, speed) => {
    const i = Math.floor(r() * (pts.length - 1));
    const a = pts[i];
    const b = pts[i + 1];
    const t = r();
    p.place(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0);
    p.walk(pts, { loop: true, speed, start: i + 1, dir: 1 });
    p.idleRole = r() < 0.5 ? 'idle' : 'idle2';
    civilians.push(p);
    return p;
  };
  /** Back and forth between two points. */
  const onLine = (p, a, b, speed) => {
    const t = r();
    p.place(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0);
    p.walk([a, b], { loop: true, speed, start: r() < 0.5 ? 0 : 1, dir: 1 });
    civilians.push(p);
    return p;
  };
  const loopRect = (x0, z0, x1, z1) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }, { x: x0, z: z0 }];
  const northLoop = loopRect(62, 76, 122, 116);
  const northLoopCw = [...northLoop].reverse();

  // Joggers: the river promenade (north-bound in front of Kast's lane, south-bound well behind
  // it), the north loop and the diagonal path, which Kast meets head-on.
  onLoop(runner(false), [{ x: 146.5, z: 280 }, { x: 146.5, z: 62 }, { x: 155, z: 62 }, { x: 155, z: 280 }, { x: 146.5, z: 280 }], 3.1);
  onLoop(runner(true), northLoop, 2.8);
  onLoop(runner(false), northLoopCw, 3.3);
  // Up and down the diagonal path, a metre beyond Kast's line, so the two meet head-on.
  onLoop(runner(r() < 0.4), [
    { x: 52, z: 127.6 }, { x: 70.6, z: 138.9 }, { x: 100.6, z: 158.8 }, { x: 134.4, z: 184.6 }, { x: 141, z: 189.6 },
    { x: 134.4, z: 184.6 }, { x: 100.6, z: 158.8 }, { x: 70.6, z: 138.9 }, { x: 52, z: 127.6 }
  ], 2.9);
  onLine(runner(true), { x: 99.6, z: 246 }, { x: 100.1, z: 168 }, 2.7);

  // Walkers: north loop, path south of the kiosk, the promenade behind Kast's lane.
  onLoop(walker(false), northLoop, 1.2);
  onLoop(walker(true), northLoopCw, 1.1);
  onLine(walker(r() < 0.5), { x: 155.6, z: 70 }, { x: 155.6, z: 270 }, 1.25);
  onLine(walker(r() < 0.5), { x: 145, z: 236 }, { x: 145, z: 268 }, 1.05);

  // Dog walkers (the dogs are attached once the model is loaded).
  /** @type {Person[]} */
  const dogOwners = [];
  dogOwners.push(onLoop(walker(true), northLoop, 1.15));
  dogOwners.push(onLine(walker(false), { x: 98.6, z: 246 }, { x: 99.4, z: 178 }, 1.1));
  dogOwners.push(onLine(walker(r() < 0.5), { x: 156.4, z: 64 }, { x: 156.4, z: 276 }, 1.2));

  // Kiosk: two people queueing at the counter, a pair chatting nearby.
  for (const q of [{ x: 109.6, z: 223.6, face: Math.PI / 2, role: 'phone' }, { x: 108.4, z: 222.1, face: Math.PI / 2 - 0.4, role: 'idle' }]) {
    const p = walker(r() < 0.4);
    p.place(q.x, q.z, q.face);
    p.standStill(q.face, q.role);
    civilians.push(p);
  }
  // Pairs talking on the lawns (all well clear of the sight lines to Kast's route).
  for (const [x, z] of [[106.4, 228.6], [78, 221], [116, 240], [92, 104], [134, 108]]) {
    const a = walker(r() < 0.4);
    const b = walker(r() < 0.5);
    const turn = r() * Math.PI;
    const cx = Math.cos(turn) * 0.6;
    const cz = Math.sin(turn) * 0.6;
    const face = Math.atan2(-cx, -cz);
    a.place(x + cx, z + cz, face);
    b.place(x - cx, z - cz, face + Math.PI);
    a.standStill(face, 'talk');
    b.standStill(face + Math.PI, r() < 0.5 ? 'idle' : 'idle2');
    civilians.push(a, b);
  }

  // People sitting on benches: posed by hand, lowered onto the seat.
  /** @type {{ p: Person, rig: any }[]} */
  const sitters = [];
  for (const b of BENCHES.filter((b) => b.sit)) {
    const p = walker(r() < 0.4);
    const fx = Math.sin(b.face);
    const fz = Math.cos(b.face);
    p.place(b.x + fx * 0.1, b.z + fz * 0.1, b.face);
    const rig = rigOf(p);
    pose(p, rig, SIT_POSE);
    if (rig && rig.bones.Bip01_L_Foot) {
      p.root.updateMatrixWorld(true);
      const foot = rig.bones.Bip01_L_Foot.getWorldPosition(new THREE.Vector3());
      const drop = Math.max(0, Math.min(0.6, foot.y - (WALK_Y + 0.1)));
      p.place(p.x, p.z, b.face, WALK_Y - drop);
    }
    p.flee = (exits) => {
      p.groundY = WALK_Y;
      p.root.position.y = WALK_Y;
      Person.prototype.flee.call(p, exits);
    };
    sitters.push({ p, rig });
    civilians.push(p);
  }

  // Cyclists on the river cycle lane (behind Kast's lane) and around the north loop.
  /** @type {any[]} */
  const riders = [];
  const ride = (pts, speed) => {
    const p = walker(r() < 0.3);
    const lens = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
      lens.push(l);
      total += l;
    }
    /** @type {any} */
    const rider = { p, pts, lens, total, d: r() * total, speed, mul: 1, phase: r() * 6, rig: null, bike: null, tipped: false };
    p.place(pts[0].x, pts[0].z, 0);
    rider.rig = rigOf(p);
    p.flee = () => {
      rider.mul = 1.7;
    };
    riders.push(rider);
    civilians.push(p);
    moveRider(rider, 0, true);
    return rider;
  };
  ride([{ x: 159, z: 62 }, { x: 159, z: 282 }, { x: 157.6, z: 282 }, { x: 157.6, z: 62 }, { x: 159, z: 62 }], 5.2);
  ride([{ x: 157.6, z: 200 }, { x: 157.6, z: 62 }, { x: 159, z: 62 }, { x: 159, z: 282 }, { x: 157.6, z: 282 }, { x: 157.6, z: 200 }], 4.6);
  ride([...northLoopCw].map((q) => ({ x: q.x + (q.x < 90 ? 0.8 : -0.8), z: q.z + (q.z < 90 ? 0.8 : -0.8) })), 4.2);

  // ---------- Kast and his bodyguard ----------
  const target = make(avatar(TARGET_AVATAR), KAST_LOOK, 1.83);
  target.place(ROUTE[0].x, ROUTE[0].z, 0);
  target.walk(ROUTE.slice(1), { loop: false, speed: RUN_SPEED });
  const stretchFace = (() => {
    const l = losAt(PARK.stretch.x, PARK.stretch.z);
    return Math.atan2(l.x, l.z);
  })();

  // The guard runs at Kast's shoulder: 1.3 m to the right of him as the shooter sees it and a
  // little further away, so he never stands between the roof and his boss.
  const guard = make(avatar(GUARD_AVATAR), GUARD_LOOK, 1.88);
  guard.idleRole = 'idle2';
  escort = guard;
  let guardFled = false;
  const placeGuard = () => {
    const l = losAt(target.x, target.z);
    guard.root.position.set(target.x - l.z * 1.3 + l.x * 0.9, target.root.position.y, target.z + l.x * 1.3 + l.z * 0.9);
    guard.root.rotation.y = target.root.rotation.y;
  };
  placeGuard();
  guard.flee = (exits) => {
    // While Kast lives the guard stays with him; once he is down, the guard runs.
    if (target.alive) return;
    guardFled = true;
    Person.prototype.flee.call(guard, exits);
  };
  civilians.push(guard);

  const exits = [
    { x: 50, z: 128.6 }, { x: 98.5, z: 256 }, { x: 56, z: 56 }, { x: 138, z: 56 },
    { x: 150, z: 56 }, { x: 150, z: 296 }, { x: 44, z: 70 }
  ];

  // ---------- bikes and dogs, once loaded ----------
  /** @type {{ owner: Person, holder: THREE.Object3D, mixer: THREE.AnimationMixer | null, side: number }[]} */
  const dogs = [];
  loadExtras().then((m) => {
    if (token !== crowdToken || !target.root.parent) return;
    const group = new THREE.Group();
    group.name = 'park-bikes-dogs';
    target.root.parent.add(group);
    extras = group;
    if (m.bike) {
      for (const rider of riders) {
        const holder = new THREE.Group();
        const tilt = new THREE.Group();
        for (const [mat, geo] of m.bike) {
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          tilt.add(mesh);
        }
        holder.add(tilt);
        group.add(holder);
        rider.bike = holder;
        moveRider(rider, 0, true);
      }
    }
    if (m.dog) {
      dogOwners.forEach((owner, i) => {
        const holder = new THREE.Group();
        const body = /** @type {THREE.Object3D} */ (SkeletonUtils.clone(m.dog.proto));
        body.scale.multiplyScalar(m.dog.scale);
        body.position.set(-m.dog.centre.x * m.dog.scale, -m.dog.minY * m.dog.scale, -m.dog.centre.z * m.dog.scale);
        const turn = new THREE.Group();
        turn.rotation.y = m.dog.yaw;
        turn.add(body);
        holder.add(turn);
        body.traverse((o) => {
          const mesh = /** @type {any} */ (o);
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.frustumCulled = false;
          }
        });
        let mixer = null;
        if (m.dog.clip) {
          mixer = new THREE.AnimationMixer(body);
          const action = mixer.clipAction(m.dog.clip);
          action.time = (i * 1.3) % Math.max(0.1, m.dog.clip.duration);
          action.play();
        }
        group.add(holder);
        dogs.push({ owner, holder, mixer, side: i % 2 ? -1 : 1 });
      });
    }
  });

  return {
    civilians,
    target,
    targetLook: KAST_LOOK,
    exits,
    panicTarget(t) {
      // Kast sprints straight for the gate and the car.
      const gate = { x: 50.5, z: 128.6 };
      const door = { x: PARK.door.x, z: PARK.door.z };
      t.path = t.x > gate.x + 0.5 ? [gate, door] : [door];
      t.index = 0;
      t.loop = false;
      t.wait = 0;
      t.speed = 4.6;
      t.mode = 'walk';
      t.panicDelay = 0.3;
    },
    update(dt) {
      // Kast turns to the bar while he stretches.
      if (target.alive && target.wait > 0 && Math.hypot(target.x - PARK.stretch.x, target.z - PARK.stretch.z) < 0.5) {
        let diff = stretchFace - target.root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        target.root.rotation.y += diff * Math.min(1, dt * 3);
      }
      // The guard keeps pace at Kast's shoulder, running when he runs.
      if (guard.alive && !guardFled && guard.mode !== 'gone') {
        if (target.alive && target.mode !== 'gone') {
          placeGuard();
          const v = target.velocity();
          const speed = Math.hypot(v.x, v.z);
          const role = speed > 2.5 ? 'run' : speed > 0.1 ? 'walk' : 'idle';
          guard.play(role, 0.3);
          const a = guard.actions[role];
          const clip = guard.base.clips[role];
          if (a && clip && clip.speed > 0 && role !== 'idle') a.timeScale = speed / clip.speed;
        } else if (!target.alive) {
          guard.flee(exits);
        }
      }
      for (const rider of riders) moveRider(rider, dt, false);
      for (const d of dogs) {
        const o = d.owner;
        if (o.mode === 'gone') {
          d.holder.visible = false;
          continue;
        }
        let speed = 0;
        if (o.alive) {
          const v = o.velocity();
          speed = Math.hypot(v.x, v.z);
          const yaw = o.root.rotation.y;
          const fx = Math.sin(yaw);
          const fz = Math.cos(yaw);
          d.holder.position.set(o.x + fx * 1.05 - fz * 0.45 * d.side, WALK_Y, o.z + fz * 1.05 + fx * 0.45 * d.side);
          d.holder.rotation.y = yaw;
        }
        d.holder.visible = o.root.visible || !o.alive;
        if (d.mixer && d.holder.visible) {
          d.mixer.timeScale = Math.min(2.5, speed / 1.4);
          d.mixer.update(dt);
        }
      }
    },
    escaped() {
      return target.mode === 'idle' && target.index === target.path.length - 1 &&
        Math.hypot(target.x - PARK.door.x, target.z - PARK.door.z) < 0.6;
    }
  };
}

/**
 * Moves a cyclist along their loop, poses the pedalling and keeps the bike under them. A shot
 * cyclist falls; the bike tips over beside them.
 * @param {any} rider
 * @param {number} dt
 * @param {boolean} snap set the heading at once (first placement)
 */
function moveRider(rider, dt, snap) {
  const p = /** @type {Person} */ (rider.p);
  const bike = /** @type {THREE.Object3D | null} */ (rider.bike);
  if (p.mode === 'gone') {
    if (bike) bike.visible = false;
    return;
  }
  if (!p.alive) {
    if (bike && !rider.tipped) {
      rider.tipped = true;
      bike.children[0].rotation.z = 1.42;
      bike.children[0].position.y = 0.12;
    }
    return;
  }
  rider.d = (rider.d + rider.speed * rider.mul * dt) % rider.total;
  let d = rider.d;
  let i = 0;
  while (i < rider.lens.length - 1 && d > rider.lens[i]) {
    d -= rider.lens[i];
    i++;
  }
  const a = rider.pts[i];
  const b = rider.pts[i + 1];
  const t = rider.lens[i] > 0 ? Math.min(1, d / rider.lens[i]) : 0;
  p.root.position.set(a.x + (b.x - a.x) * t, WALK_Y, a.z + (b.z - a.z) * t);
  const want = Math.atan2(b.x - a.x, b.z - a.z);
  let diff = want - p.root.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  p.root.rotation.y += snap ? diff : diff * Math.min(1, dt * 5);
  rider.phase += (dt * rider.speed * rider.mul * Math.PI * 2) / 4.2;
  if (p.root.visible || snap) pose(p, rider.rig, ridePose(rider.phase));
  if (bike) {
    const yaw = p.root.rotation.y;
    bike.position.set(p.x + Math.sin(yaw) * 0.29, WALK_Y, p.z + Math.cos(yaw) * 0.29);
    bike.rotation.y = yaw;
    bike.visible = p.root.visible;
  }
}

// ---------- set dressing ----------

/** Benches: position and the direction the seat faces (radians, 0 = south). `sit`: someone sits. */
const BENCHES = [
  { x: 143.6, z: 112, face: Math.PI / 2, sit: false },
  { x: 143.6, z: 228, face: Math.PI / 2, sit: true },
  { x: 80, z: 73.4, face: 0, sit: true },
  { x: 104, z: 118.6, face: Math.PI, sit: false },
  { x: 102.8, z: 206, face: -Math.PI / 2, sit: true },
  { x: 95.2, z: 232, face: Math.PI / 2, sit: false }
];

/** Buildings across the streets (downtown_towers parts): centre and the slot they fit in. */
const FACADES = [
  { name: 'Downtown_BrownstoneOffice_2', x: 27.4, z: 222, w: 15, d: 40 },
  { name: 'Downtown_ModernOffice_3', x: 28.4, z: 185, w: 14, d: 24 },
  { name: 'Downtown_ModernOffice_2', x: 29.6, z: 155, w: 11, d: 22 },
  { name: 'Downtown_BrownstoneOffice_2', x: 27.4, z: 104, w: 15, d: 40 },
  { name: 'Downtown_BrownstoneOffice_1', x: 88, z: 271, w: 54, d: 19.6 }
];

/**
 * Builds the park. Async: it waits for the ground textures and the Sketchfab models, each of
 * which falls back to plain shapes when missing.
 * @param {THREE.Scene} scene
 */
export async function parkDress(scene) {
  const group = new THREE.Group();
  group.name = 'park-dressing';
  /** @type {number[][]} */
  const colliders = [];
  /** @type {THREE.Object3D[]} */
  const rangeMeshes = [];
  const solid = (x0, y0, z0, x1, y1, z1) => colliders.push([x0, y0, z0, x1, y1, z1]);

  const manifest = await loadManifest().catch(() => null);
  const [grassTex, paveTex, roofTex, downtown, props1, props2, treeGltf, fallbackTree, kioskGltf, barGltf, carGltf] = await Promise.all([
    loadGroundMaterial(manifest, 'grass', 3),
    loadGroundMaterial(manifest, 'sidewalk', 3),
    loadGroundMaterial(manifest, 'roof', 4),
    loadPack('downtown_towers'),
    loadPack('city_props_1'),
    loadPack('city_props_2'),
    loadGLTF(SF + 'park_trees.glb').catch(() => null),
    loadGLTF('./models/props/tree.glb').catch(() => null),
    loadGLTF(SF + 'kiosk.glb').catch(() => null),
    loadGLTF(SF + 'pullup_bar.glb').catch(() => null),
    loadGLTF('./models/props/sedan_wagon.glb').catch(() => null),
    loadExtras()
  ]);

  const mats = {
    grass: grassTex || fallbackGrass(),
    pave: paveTex || new THREE.MeshStandardMaterial({ color: '#a7a39b', roughness: 0.9 }),
    roof: roofTex || new THREE.MeshStandardMaterial({ color: '#8e8c87', roughness: 0.95 }),
    stone: new THREE.MeshStandardMaterial({ color: '#b9b1a3', roughness: 0.85 }),
    iron: new THREE.MeshStandardMaterial({ color: '#1b1d1f', roughness: 0.45, metalness: 0.7 }),
    hedge: new THREE.MeshStandardMaterial({ color: '#3a5527', roughness: 1 }),
    steel: new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.35, metalness: 0.8 })
  };
  if (mats.grass.userData) mats.grass.userData.metresPerTile = mats.grass.userData.metresPerTile || 3;

  /** @type {Map<THREE.Material, THREE.BufferGeometry[]>} */
  const parts = new Map();
  const add = (mat, geo) => {
    if (!parts.has(mat)) parts.set(mat, []);
    parts.get(mat).push(geo);
  };
  const box = (mat, x, y, z, w, h, d, rotY = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    add(mat, g);
  };
  const cylinder = (mat, x, y, z, r0, r1, h, seg = 12) => {
    const g = new THREE.CylinderGeometry(r0, r1, h, seg);
    g.translate(x, y, z);
    add(mat, g);
  };

  // ---------- ground: lawn, paths, pavements ----------
  const L = PARK.lawn;
  const lawn = new THREE.Mesh(worldUV(slabGeo(L.x0, L.z0, L.x1, L.z1, 0, 0.12), tileOf(mats.grass, 3)), mats.grass);
  lawn.receiveShadow = true;
  group.add(lawn);
  rangeMeshes.push(lawn);

  const paveTile = tileOf(mats.pave, 3);
  /** @type {THREE.BufferGeometry[]} */
  const paving = [];
  for (const path of PATHS) {
    for (let i = 0; i < path.pts.length - 1; i++) {
      const [ax, az] = path.pts[i];
      const [bx, bz] = path.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.BoxGeometry(len, 0.05, path.w);
      g.rotateY(Math.atan2(-(bz - az), bx - ax));
      g.translate((ax + bx) / 2, WALK_Y - 0.025, (az + bz) / 2);
      paving.push(worldUV(g, paveTile));
      const joint = new THREE.CylinderGeometry(path.w / 2, path.w / 2, 0.05, 16);
      joint.translate(bx, WALK_Y - 0.025, bz);
      paving.push(worldUV(joint, paveTile));
    }
  }
  // The fitness corner's paved pad, the west and south pavements.
  const pad = new THREE.CylinderGeometry(3.8, 3.8, 0.05, 24);
  pad.translate(PARK.stretch.x + 0.6, WALK_Y - 0.025, PARK.stretch.z - 0.4);
  paving.push(worldUV(pad, paveTile));
  paving.push(worldUV(slabGeo(46, 60, 50, 252, 0, WALK_Y), paveTile));
  paving.push(worldUV(slabGeo(38, 250, 142, 253.5, 0, WALK_Y), paveTile));
  paving.push(worldUV(slabGeo(35.5, 60, 39.5, 256, 0, WALK_Y), paveTile));
  paving.push(worldUV(slabGeo(38, 259.6, 142, 261.2, 0, WALK_Y), paveTile));
  const paved = new THREE.Mesh(mergeGeometries(paving, false), mats.pave);
  paved.receiveShadow = true;
  group.add(paved);
  rangeMeshes.push(paved);
  for (const g of paving) g.dispose();

  // ---------- the shooter's building: corner block, flat roof, parapets ----------
  const R = PARK.roof;
  const facade = facadeMaterial('concrete');
  const block = new THREE.Mesh(buildingGeometry(R.x1 - R.x0, R.y, R.z1 - R.z0), [facade, facade, mats.roof, mats.roof, facade, facade]);
  block.position.set((R.x0 + R.x1) / 2, R.y / 2, (R.z0 + R.z1) / 2);
  block.castShadow = block.receiveShadow = true;
  group.add(block);
  rangeMeshes.push(block);
  solid(R.x0, 0, R.z0, R.x1, R.y, R.z1);
  // Parapets on the north and east edges (in front of the shooter) and the far sides.
  box(mats.stone, R.x1 - 0.2, R.y + 0.42, (R.z0 + R.z1) / 2, 0.4, 0.84, R.z1 - R.z0);
  box(mats.stone, (R.x0 + R.x1) / 2, R.y + 0.42, R.z0 + 0.2, R.x1 - R.x0, 0.84, 0.4);
  box(mats.stone, R.x0 + 0.2, R.y + 0.42, (R.z0 + R.z1) / 2, 0.4, 0.84, R.z1 - R.z0);
  box(mats.stone, (R.x0 + R.x1) / 2, R.y + 0.42, R.z1 - 0.2, R.x1 - R.x0, 0.84, 0.4);
  solid(R.x1 - 0.4, R.y, R.z0, R.x1, R.y + 0.84, R.z1);
  solid(R.x0, R.y, R.z0, R.x1, R.y + 0.84, R.z0 + 0.4);
  // A roof hatch and a vent stack behind the shooter.
  box(mats.stone, 26, R.y + 0.6, 272, 2.4, 1.2, 2.4);
  cylinder(mats.steel, 31, R.y + 0.9, 276, 0.3, 0.3, 1.8);

  // ---------- fences, gates and the north hedge ----------
  const fence = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 0.24));
    const rot = Math.atan2(-(bz - az), bx - ax);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      box(mats.iron, ax + (bx - ax) * t, 0.75, az + (bz - az) * t, 0.028, 1.5, 0.028);
    }
    for (const y of [0.16, 1.32]) box(mats.iron, (ax + bx) / 2, y, (az + bz) / 2, len, 0.05, 0.05, rot);
  };
  const pillar = (x, z) => {
    box(mats.stone, x, 1.1, z, 0.7, 2.2, 0.7);
    box(mats.stone, x, 2.28, z, 0.86, 0.16, 0.86);
    solid(x - 0.35, 0, z - 0.35, x + 0.35, 2.36, z + 0.35);
  };
  const G = PARK.gate;
  fence(G.x, L.z0 + 0.4, G.x, G.z0 - 0.35);
  fence(G.x, G.z1 + 0.35, G.x, L.z1);
  fence(G.x, L.z1, PARK.southGate.x0 - 0.35, L.z1);
  fence(PARK.southGate.x1 + 0.35, L.z1, L.x1, L.z1);
  for (const [x, z] of [[G.x, G.z0], [G.x, G.z1], [G.x, L.z1], [G.x, L.z0 + 0.4], [PARK.southGate.x0, L.z1], [PARK.southGate.x1, L.z1], [L.x1, L.z1]]) pillar(x, z);
  // The west gate's leaves stand open toward the street.
  box(mats.iron, G.x - 1.15, 0.8, G.z0 + 0.42, 1.9, 1.5, 0.05);
  box(mats.iron, G.x - 1.15, 0.8, G.z1 - 0.42, 1.9, 1.5, 0.05);
  box(mats.hedge, (L.x0 + L.x1) / 2, 0.75, L.z0 + 0.6, L.x1 - L.x0, 1.5, 1.1);

  // ---------- fitness corner: the bar Kast stretches at, and a drinking fountain ----------
  const S = PARK.stretch;
  const l = losAt(S.x, S.z);
  const barSpot = { x: S.x + l.x * 1.1, z: S.z + l.z * 1.1 };
  const barYaw = Math.atan2(l.x, l.z);
  if (barGltf) {
    const baked = bakeByMaterial(barGltf.scene);
    normalise(baked, { height: 2.25 });
    for (const [mat, geo] of baked) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(barSpot.x, WALK_Y, barSpot.z);
      mesh.rotation.y = barYaw;
      mesh.castShadow = true;
      group.add(mesh);
    }
  } else {
    // Two posts and a bar across, square to the shooter's line.
    const px = -l.z * 0.55;
    const pz = l.x * 0.55;
    for (const s of [-1, 1]) cylinder(mats.iron, barSpot.x + px * s, WALK_Y + 1.1, barSpot.z + pz * s, 0.04, 0.04, 2.2, 8);
    box(mats.steel, barSpot.x, WALK_Y + 2.2, barSpot.z, 1.2, 0.05, 0.05, Math.atan2(-pz, px));
  }
  const fountain = { x: S.x + l.x * 0.6 + l.z * 2.2, z: S.z + l.z * 0.6 - l.x * 2.2 };
  cylinder(mats.stone, fountain.x, WALK_Y + 0.45, fountain.z, 0.2, 0.26, 0.9, 12);
  cylinder(mats.steel, fountain.x, WALK_Y + 0.95, fountain.z, 0.32, 0.22, 0.14, 16);
  solid(fountain.x - 0.32, 0, fountain.z - 0.32, fountain.x + 0.32, WALK_Y + 1.02, fountain.z + 0.32);

  // ---------- the kiosk (x 113, z 223, counter facing west onto the path) ----------
  // From the roof it sits 20 m or more beside every sight line to Kast, well below them.
  const kiosk = { x: 113.4, z: 223 };
  if (kioskGltf) {
    const baked = bakeByMaterial(kioskGltf.scene);
    normalise(baked, { length: 4.6 });
    const k = new THREE.Group();
    for (const [mat, geo] of baked) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      k.add(mesh);
    }
    k.position.set(kiosk.x, WALK_Y, kiosk.z);
    k.rotation.y = -Math.PI / 2;
    group.add(k);
    const s = solidOf(k);
    colliders.push(s.box);
    rangeMeshes.push(...s.meshes);
  } else {
    box(mats.stone, kiosk.x, WALK_Y + 1.4, kiosk.z, 3.2, 2.8, 3.6);
    box(mats.iron, kiosk.x, WALK_Y + 2.9, kiosk.z, 3.8, 0.2, 4.2);
    solid(kiosk.x - 1.9, 0, kiosk.z - 2.1, kiosk.x + 1.9, 3.1, kiosk.z + 2.1);
  }

  // ---------- benches, lamps, bins, the quay railing ----------
  const prop = (pack, name) => pack && pack.parts.get(name);
  const benchPart = prop(props1, 'ParkBenchLong');
  for (const b of BENCHES) {
    // Benches are 3.2 m long along their seat; the collider is the seat (people sit above it).
    const along = Math.abs(Math.sin(b.face)) > 0.5;
    const hx = along ? 0.5 : 1.6;
    const hz = along ? 1.6 : 0.5;
    solid(b.x - hx, 0, b.z - hz, b.x + hx, WALK_Y + 0.45, b.z + hz);
    if (!benchPart) {
      box(mats.stone, b.x, WALK_Y + 0.22, b.z, 0.5, 0.44, 1.8, b.face);
      box(mats.iron, b.x - Math.sin(b.face) * 0.28, WALK_Y + 0.5, b.z - Math.cos(b.face) * 0.28, 0.08, 0.5, 1.8, b.face);
    }
  }
  const benchSet = instancePart(group, benchPart, BENCHES.map((b) => ({ x: b.x, z: b.z, y: WALK_Y, rot: b.face + Math.PI / 2 })));
  if (benchSet) rangeMeshes.push(...benchSet.children);
  const lamps = [];
  for (let z = 72; z <= 272; z += 25) lamps.push({ x: 143.3, z });
  for (const [x, z] of [[129, 177.5], [93, 151.5], [62.5, 133], [96.6, 198], [96.6, 236], [124.4, 74], [59.6, 118]]) lamps.push({ x, z });
  const lampPart = prop(props1, 'Light');
  if (lampPart) instancePart(group, lampPart, lamps.map((p) => ({ ...p, y: WALK_Y, s: 1.2 })));
  else for (const p of lamps) cylinder(mats.iron, p.x, WALK_Y + 2.5, p.z, 0.06, 0.09, 5, 8);
  instancePart(group, prop(props1, 'TrashCanLarge'), [[143.4, 115.6], [143.4, 224.4], [83.4, 73.4], [102.8, 202.2], [53.2, 125.6], [131, 190.6]].map(([x, z]) => ({ x, z, y: WALK_Y })));
  const rails = [];
  for (let z = 66; z <= 276; z += 9.8) rails.push({ x: 161.5, z, y: WALK_Y, rot: Math.PI / 2 });
  const railPart = prop(props2, 'rail_long');
  if (railPart) instancePart(group, railPart, rails);
  else box(mats.iron, 161.5, WALK_Y + 1, 171, 0.06, 0.06, 214);

  // ---------- trees: kept off every sight line to Kast's route ----------
  plantParkTrees(group, treeGltf, fallbackTree);

  // ---------- the waiting car on the west street, facing north ----------
  carObj = buildCar(carGltf);
  carObj.position.set(PARK.car.x, 0, PARK.car.z);
  carObj.rotation.y = Math.PI;
  group.add(carObj);
  solid(PARK.car.x - 0.95, 0, PARK.car.z - 2.2, PARK.car.x + 0.95, 1.5, PARK.car.z + 2.2);
  carObj.traverse((o) => {
    if (/** @type {any} */ (o).isMesh) rangeMeshes.push(o);
  });

  // ---------- facades across the streets, and a far shore across the water ----------
  for (const f of FACADES) {
    const part = downtown && downtown.parts.get(f.name);
    if (part) {
      const fit = fitScale(part, f.w, f.d);
      const obj = placePart(group, part, { x: f.x, z: f.z, rot: fit.rot, s: fit.s });
      const s = solidOf(obj);
      colliders.push(s.box);
      rangeMeshes.push(...s.meshes);
    } else {
      const h = 18 + (f.w % 7) * 2;
      const fm = facadeMaterial(f.w > 30 ? 'stone' : 'office');
      const mesh = new THREE.Mesh(buildingGeometry(f.w, h, f.d), [fm, fm, mats.roof, mats.roof, fm, fm]);
      mesh.position.set(f.x, h / 2, f.z);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      rangeMeshes.push(mesh);
      solid(f.x - f.w / 2, 0, f.z - f.d / 2, f.x + f.w / 2, h, f.z + f.d / 2);
    }
  }
  farShore(group);

  // Merge the procedural parts per material: one draw call each.
  for (const [mat, list] of parts) {
    const geo = mergeGeometries(list, false);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    rangeMeshes.push(mesh);
    for (const g of list) g.dispose();
  }
  scene.add(group);
  return { group, colliders, rangeMeshes };
}

/** Tile size in metres of a ground material, or the fallback. */
function tileOf(mat, fallback) {
  return (mat.userData && mat.userData.metresPerTile) || fallback;
}

/** A box from (x0, y0, z0) to (x1, y1, z1). */
function slabGeo(x0, z0, x1, z1, y0, y1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/** World-space UVs (metres / tile), so ground textures keep their scale across pieces. */
function worldUV(g, tile) {
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile + pos.getY(i) / tile);
  uv.needsUpdate = true;
  return g;
}

/** Mown-grass fallback: a noisy green canvas texture. */
function fallbackGrass() {
  const mat = new THREE.MeshStandardMaterial({ color: '#5d7a35', roughness: 1 });
  if (typeof document === 'undefined') return mat;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return mat;
  const r = rng(717);
  g.fillStyle = '#7a9a4a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) {
    const v = 90 + Math.floor(r() * 70);
    g.fillStyle = 'rgb(' + Math.floor(v * 0.55) + ',' + v + ',' + Math.floor(v * 0.35) + ')';
    g.fillRect(Math.floor(r() * 128), Math.floor(r() * 128), 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  mat.map = tex;
  mat.color.set('#ffffff');
  mat.userData.metresPerTile = 3;
  return mat;
}

/**
 * Splits a baked pack holding two trees side by side (along x) and keeps the fuller one.
 * @param {Map<THREE.Material, THREE.BufferGeometry>} baked
 */
function oneTree(baked) {
  const all = new THREE.Box3();
  for (const g of baked.values()) {
    g.computeBoundingBox();
    all.union(g.boundingBox);
  }
  const cx = (all.min.x + all.max.x) / 2;
  /** @type {Map<THREE.Material, THREE.BufferGeometry>[]} */
  const sides = [new Map(), new Map()];
  const tris = [0, 0];
  for (const [mat, g] of baked) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const out = [0, 1].map(() => ({ p: [], n: [], u: [] }));
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const side = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3 < cx ? 0 : 1;
      const o = out[side];
      for (let k = i; k < i + 3; k++) {
        o.p.push(pos.getX(k), pos.getY(k), pos.getZ(k));
        if (nor) o.n.push(nor.getX(k), nor.getY(k), nor.getZ(k));
        if (uv) o.u.push(uv.getX(k), uv.getY(k));
      }
      tris[side]++;
    }
    out.forEach((o, s) => {
      if (!o.p.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3));
      if (o.n.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3));
      if (o.u.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(o.u, 2));
      sides[s].set(mat, geo);
    });
  }
  return tris[0] >= tris[1] ? sides[0] : sides[1];
}

/**
 * Park trees, instanced: the Sketchfab broadleaf tree (or the city's tree model). Candidate
 * spots on a jittered grid over the lawn and a row along the quay railing; a spot is
 * dropped when it is on a path, near a placed object or another tree, or when blocksView says
 * its crown would hide any part of Kast's route from the roof.
 */
function plantParkTrees(group, treeGltf, fallbackTree) {
  /** @type {Map<THREE.Material, THREE.BufferGeometry> | null} */
  let baked = null;
  if (treeGltf) baked = oneTree(bakeByMaterial(treeGltf.scene));
  else if (fallbackTree) baked = bakeByMaterial(fallbackTree.scene);
  if (!baked || !baked.size) return;
  for (const mat of baked.keys()) {
    const sm = /** @type {THREE.MeshStandardMaterial} */ (mat);
    if (sm.isMeshStandardMaterial) {
      sm.metalness = 0;
      sm.roughness = Math.max(0.8, sm.roughness);
    }
  }
  const size = normalise(baked, { height: 1 });
  const crown = Math.max(size.width, size.depth) / 2;
  const r = rng(7070);
  /** @type {{ x: number, z: number }[]} */
  const cand = [];
  for (let x = 56; x <= 138; x += 10) {
    for (let z = 70; z <= 244; z += 10) cand.push({ x: x + (r() - 0.5) * 6, z: z + (r() - 0.5) * 6 });
  }
  for (let z = 70; z <= 276; z += 13) cand.push({ x: 160.8 + (r() - 0.5) * 0.4, z });
  // Away from paths (centre lines), the kiosk, the fitness corner, benches and the gate.
  const segs = [];
  for (const p of PATHS) for (let i = 0; i < p.pts.length - 1; i++) segs.push({ a: p.pts[i], b: p.pts[i + 1], w: p.w });
  const keepOut = [
    { x: 113.4, z: 223, r: 7 }, { x: PARK.stretch.x, z: PARK.stretch.z, r: 8 }, { x: 50, z: 128.6, r: 6 },
    ...BENCHES.map((b) => ({ x: b.x, z: b.z, r: 4 }))
  ];
  /** @type {{ x: number, z: number, h: number }[]} */
  const spots = [];
  for (const c of cand) {
    const h = 9.5 + r() * 3.5;
    const radius = crown * h;
    const river = c.x > 150;
    if (!river && (c.x < PARK.lawn.x0 + 3 || c.x > PARK.lawn.x1 - 3 || c.z < PARK.lawn.z0 + 3 || c.z > PARK.lawn.z1 - 3)) continue;
    if (segs.some((s) => distToSeg(c.x, c.z, s.a, s.b) < s.w / 2 + 1.6)) continue;
    if (keepOut.some((k) => Math.hypot(c.x - k.x, c.z - k.z) < k.r)) continue;
    if (spots.some((s) => Math.hypot(c.x - s.x, c.z - s.z) < (river ? 11 : 12))) continue;
    if (blocksView(c.x, c.z, radius + 0.8, h)) continue;
    spots.push({ x: c.x, z: c.z, h });
  }
  const set = instanced(baked, spots.length);
  spots.forEach((s, i) => set.set(i, place(s.x, 0.1, s.z, r() * Math.PI * 2, s.h)));
  set.finish();
  group.add(set.group);
}

/** Distance from (x, z) to the segment a-b ([x, z] pairs). */
function distToSeg(x, z, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2));
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}

/** The black sedan (CC-BY sedan model, or a box car), front toward local +z. */
function buildCar(gltf) {
  const g = new THREE.Group();
  g.name = 'park-car';
  if (gltf) {
    const baked = bakeByMaterial(gltf.scene, (mesh) => {
      let o = /** @type {THREE.Object3D | null} */ (mesh);
      while (o) {
        if (o.name === 'body_sedan') return true;
        o = o.parent;
      }
      return false;
    });
    if (baked.size) {
      normalise(baked, { length: 4.4 });
      for (const [mat, geo] of baked) {
        const name = (mat.name || '').toLowerCase();
        /** @type {THREE.Material} */
        let m;
        if (/^body(\.\d+)?$/.test(name)) m = new THREE.MeshPhysicalMaterial({ color: '#0f1114', roughness: 0.3, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 });
        else if (name.includes('window')) m = new THREE.MeshStandardMaterial({ color: '#0c1015', roughness: 0.05, metalness: 0.85 });
        else {
          const c = /** @type {THREE.MeshStandardMaterial} */ (mat.clone());
          if ('metalness' in c) c.metalness = name.includes('rim') ? 0.6 : 0.05;
          if ('roughness' in c) c.roughness = name.includes('tire') ? 0.9 : 0.5;
          m = c;
        }
        const mesh = new THREE.Mesh(geo, m);
        mesh.castShadow = true;
        g.add(mesh);
      }
      return g;
    }
  }
  const paint = new THREE.MeshStandardMaterial({ color: '#111316', roughness: 0.3, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: '#0c1015', roughness: 0.05, metalness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.75, 4.4), paint);
  body.position.y = 0.6;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.2), glass);
  cabin.position.set(0, 1.25, -0.2);
  body.castShadow = cabin.castShadow = true;
  g.add(body, cabin);
  return g;
}

/** Distant towers on the far shore, east across the water (two instanced batches). */
function farShore(group) {
  const r = rng(7171);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 9);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (const style of ['glassBlue', 'concrete']) {
    const inst = new THREE.InstancedMesh(geo, facadeMaterial(style), 12);
    for (let i = 0; i < 12; i++) {
      const h = 30 + Math.pow(r(), 2) * 110;
      m.compose(new THREE.Vector3(990 + r() * 380, h / 2, -40 + r() * 720), q, new THREE.Vector3(30 + r() * 40, h, 30 + r() * 40));
      inst.setMatrixAt(i, m);
    }
    inst.computeBoundingSphere();
    group.add(inst);
  }
}

/** The car pulls away north once Kast is in it; his guard got in too. */
export function parkEscape(dt, t) {
  if (escort && escort.alive && escort.mode !== 'gone') {
    escort.mode = 'gone';
    escort.root.visible = false;
  }
  if (carObj && t > 0.6) carObj.position.z -= dt * Math.min(13, (t - 0.6) * 5);
}

/** Puts the car back at the gate for a new attempt. */
export function parkReset() {
  if (carObj) carObj.position.set(PARK.car.x, 0, PARK.car.z);
}

/** Removes the bikes and dogs when another contract takes over. */
export function parkUndress() {
  clearExtras();
  carObj = null;
  escort = null;
}
