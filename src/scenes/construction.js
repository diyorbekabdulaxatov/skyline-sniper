// @ts-check
// Contract 05, Construction Site (North Quarter, 16:40, overcast). Leon Darrow, the property
// developer behind the network, tours the Northgate site with his foreman and his architect:
// the site office, the concrete pour by the mixer truck, then the builders' hoist up to the open
// fourth floor, where two investors wait to see the view. He rides down again and leaves in his
// black SUV outside the south gate; if he gets in, he is gone.
//
// The shooter is on the slewing platform of an idle tower crane on the plot to the west (see
// construction-layout.js), so only the site, the crane and the road by the gate are built.
// Builders wear yellow or orange hard hats and hi-vis vests; Darrow alone wears a white hat and
// a camel overcoat. The lines of fire for the shot windows are checked in
// test/construction.test.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGLTF } from '../assets.js';
import { loadPack, instancePart } from '../sketchfab.js';
import { bakeByMaterial } from '../instancing.js';
import {
  GROUND_Y, CRANE, RAIL, SITE, SOUTH_GATE, WEST_GATE, TOWER, FLOORS, TOP, SLAB, COLUMN, GRID_X, GRID_Z,
  FORMWORK_X, FORMWORK_H, CORE, CORE_DOOR, HOIST, HOIST_GROUND_DOOR, HOIST_TOP_DOOR, TALK, OFFICE,
  SUV, SUV_DOOR, SITE_CRANE, MIXER, POUR_STOP, FORKLIFT, STACKS, EXCAVATOR, HEAP, siteColliders
} from './construction-layout.js';

const SF = './game-assets/sketchfab/';

/** Darrow's avatar (nobody else on site uses it), recoloured to a camel overcoat. */
const TARGET_AVATAR = 'Male_Adult_03';
const BUILDERS = ['Male_Adult_05', 'Male_Adult_07', 'Male_Adult_10', 'Male_Adult_11', 'Male_Adult_12', 'Male_Adult_17', 'Male_Adult_20'];
const HAT = { white: '#f3f3ef', yellow: '#f2c419', orange: '#ef7419', blue: '#2e67c4' };
const VEST = { lime: '#c8ef2b', orange: '#ff6c16' };
const COAT = '#c69c64';

/** State shared by the people (updated every frame) and the set dressing. */
const site = {
  hoist: { y: GROUND_Y, goal: GROUND_Y, speed: 1.3 },
  /** @type {THREE.Object3D | null} */
  cage: null,
  /** @type {any} */
  machines: null,
  /** @type {THREE.Object3D | null} */
  suv: null,
  suvHome: new THREE.Vector3(),
  /** @type {any} */
  driver: null,
  time: 0
};

/** True when someone stands in the hoist cage, at the cage's height. */
function inCage(p) {
  return Math.abs(p.x - HOIST.x) < HOIST.w / 2 + 0.05 && Math.abs(p.z - HOIST.z) < HOIST.d / 2 + 0.05 &&
    Math.abs(p.root.position.y - site.hoist.y) < 0.8;
}

const faceTo = (p, x, z) => Math.atan2(x - p.x, z - p.z);

/**
 * @param {import('../people.js').CrowdKit} kit
 * @returns {import('../people.js').CrowdSetup}
 */
export function constructionPeople(kit) {
  const { r, pick, make, avatar, randomLook } = kit;
  const H = site.hoist;
  H.y = H.goal = GROUND_Y;
  H.speed = 1.3;
  site.time = 0;
  /** @type {import('../people.js').Person[]} */
  const civilians = [];
  const builder = () => make(avatar(pick(BUILDERS)), {
    ...randomLook(), hat: r() < 0.55 ? HAT.yellow : HAT.orange, vest: r() < 0.5 ? VEST.lime : VEST.orange
  }, 1.7 + r() * 0.16);

  // ---------- builders in the yard ----------
  const lanes = [
    [{ x: -14, z: -322 }, { x: -14, z: -348 }],
    [{ x: 30, z: -300 }, { x: 52, z: -300 }],
    [{ x: 50.5, z: -312 }, { x: 50.5, z: -352 }],
    [{ x: 6, z: -348 }, { x: 10, z: -364 }],
    [{ x: 16, z: -304 }, { x: 40, z: -314 }]
  ];
  for (const [a, b] of lanes) {
    for (let k = 0; k < 2; k++) {
      const p = builder();
      const t = r();
      p.place(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0, GROUND_Y);
      p.idleRole = r() < 0.5 ? 'idle' : 'idle2';
      p.walk([a, b], { loop: true, speed: 0.95 + r() * 0.4, start: k, dir: 1 });
      civilians.push(p);
    }
  }
  /** Builders standing together, facing the middle of their group: [x, z, role]. */
  const groups = [
    { c: { x: 32, z: -307.5 }, spots: [[31.3, -307.5, 'talk'], [32.7, -307.4, 'idle']] },
    { c: { x: -7, z: -340 }, spots: [[-7.8, -339.6, 'talk'], [-6.2, -339.4, 'idle2'], [-7.0, -341.0, 'idle']] },
    { c: { x: -1.5, z: -319 }, spots: [[0.6, -321.0, 'idle'], [-2.5, -321.5, 'idle2']] }
  ];
  for (const g of groups) {
    for (const [x, z, role] of g.spots) {
      const p = builder();
      p.place(/** @type {number} */ (x), /** @type {number} */ (z), 0, GROUND_Y);
      p.standStill(faceTo(p, g.c.x, g.c.z), /** @type {string} */ (role));
      civilians.push(p);
    }
  }
  const phone = builder();
  phone.place(18, -299.5, Math.PI, GROUND_Y);
  phone.standStill(Math.PI, 'phone');
  civilians.push(phone);

  // ---------- builders up on the floors ----------
  /** @type {[number, number, number, number, string][]} x, z, floor top, face, role */
  const up = [
    [13.2, -346.5, FLOORS[1], -Math.PI / 2, 'idle2'],
    [13.0, -326.5, FLOORS[2], -Math.PI / 2, 'idle'],
    [14.5, -342.5, FLOORS[3], -2.2, 'phone'],
    [36.5, -331, TOP, 0.6, 'idle'],
    [38.8, -327.5, TOP, -2.4, 'idle2']
  ];
  for (const [x, z, y, face, role] of up) {
    const p = builder();
    p.place(x, z, face, y);
    p.standStill(face, role);
    civilians.push(p);
  }

  // ---------- the investors waiting on the open floor ----------
  const investors = [['Male_Adult_04', 19.3, -327.1], ['Male_Adult_20', 19.1, -329.3]].map(([id, x, z]) => {
    const p = make(avatar(/** @type {string} */ (id)), { ...randomLook(), hat: HAT.blue }, 1.78 + r() * 0.08);
    p.place(/** @type {number} */ (x), /** @type {number} */ (z), 0, TOP);
    p.standStill(faceTo(p, TALK.x, TALK.z), 'idle');
    civilians.push(p);
    return p;
  });

  // ---------- Darrow's driver, waiting by the SUV ----------
  const driver = make(avatar('Male_Adult_11'), { ...randomLook() }, 1.83);
  driver.place(SUV.x + 1.9, SUV.z - 1.7, Math.PI, GROUND_Y);
  driver.standStill(Math.PI, 'phone');
  civilians.push(driver);
  site.driver = driver;

  // ---------- Darrow, his foreman and his architect ----------
  const targetLook = { suit: '#8a6a48', trousers: '#2a2622', skin: '#e0b49a', hair: '#3a2a1e', avatar: TARGET_AVATAR, hat: HAT.white, coat: COAT };
  const target = make(avatar(TARGET_AVATAR), targetLook, 1.84);
  const foreman = make(avatar('Male_Adult_05'), { ...randomLook(), hat: HAT.orange, vest: VEST.orange }, 1.8);
  const architect = make(avatar('Female_Adult_02'), { ...randomLook(), hat: HAT.blue }, 1.68);
  civilians.push(foreman, architect);
  const companions = [foreman, architect];

  const start = { x: 7.5, z: -298.7 };
  const cageSpot = { x: HOIST.x - 0.3, z: HOIST.z + 0.1 };
  /** @type {any[]} */
  const route = [
    { x: start.x, z: start.z, wait: 8, anim: 'talk', face: Math.PI },
    { x: 3.5, z: -306 },
    { x: POUR_STOP.x, z: POUR_STOP.z, wait: 6, anim: 'talk', face: -Math.PI / 2 },
    { x: 6.5, z: -330.5 },
    { x: HOIST_GROUND_DOOR.x, z: HOIST_GROUND_DOOR.z },
    { x: cageSpot.x, z: cageSpot.z, wait: 14, anim: 'idle', ride: TOP, face: Math.PI / 2, cage: true },
    { x: HOIST_TOP_DOOR.x, z: HOIST_TOP_DOOR.z },
    { x: 15.5, z: -331 },
    { x: TALK.x, z: TALK.z, wait: 24, anim: 'talk', face: -1.35, talk: true },
    { x: 15.5, z: -331 },
    { x: HOIST_TOP_DOOR.x, z: HOIST_TOP_DOOR.z },
    { x: cageSpot.x, z: cageSpot.z, wait: 14, anim: 'idle', ride: GROUND_Y, face: Math.PI, cage: true },
    { x: HOIST_GROUND_DOOR.x, z: HOIST_GROUND_DOOR.z },
    { x: 9, z: -326 },
    { x: 15, z: -310 },
    { x: 24.5, z: -297.5 },
    { x: 25.5, z: -292 },
    { x: 33.6, z: -287.6 },
    { x: SUV_DOOR.x, z: SUV_DOOR.z }
  ];
  const TALK_INDEX = 8;
  target.place(start.x, start.z, Math.PI, GROUND_Y);
  target.walk(route, { loop: false, speed: 1.3 });

  // The two walk with him a step to his east (away from the crane) and stop at the gate.
  const special = [
    { start: { x: 7.6, z: -300.2 }, cage: { x: HOIST.x + 0.6, z: HOIST.z - 0.75 }, talk: { x: 18.0, z: -325.9 }, off: { x: 1.2, z: -0.7 }, end: { x: 22.6, z: -299.2 } },
    { start: { x: 8.9, z: -299.6 }, cage: { x: HOIST.x + 0.6, z: HOIST.z + 0.85 }, talk: { x: 18.2, z: -330.2 }, off: { x: 1.3, z: 0.8 }, end: { x: 27.6, z: -299.8 } }
  ];
  companions.forEach((p, i) => {
    const sp = special[i];
    /** @type {any[]} */
    const path = route.slice(0, 15).map((w, k) => {
      const at = k === 0 ? sp.start : w.cage ? sp.cage : w.talk ? sp.talk : { x: w.x + sp.off.x, z: w.z + sp.off.z };
      /** @type {any} */
      const out = { x: at.x, z: at.z, wait: w.wait, anim: w.wait ? (w.talk ? 'idle' : w.anim) : undefined, ride: w.ride };
      if (w.wait) out.face = w.cage ? w.face : k === 0 || w.talk ? faceTo(at, w.x, w.z) : w.face;
      return out;
    });
    path.push({ x: sp.end.x, z: sp.end.z });
    p.place(sp.start.x, sp.start.z, faceTo(sp.start, start.x, start.z), GROUND_Y);
    p.walk(path, { loop: false, speed: 1.3 });
  });
  const riders = [target, ...companions];

  const exits = [{ x: (SOUTH_GATE.x0 + SOUTH_GATE.x1) / 2, z: SITE.z1 + 3.5 }, { x: SITE.x0 - 3, z: (WEST_GATE.z0 + WEST_GATE.z1) / 2 }];
  const settled = new Set();
  let panicked = false;
  let atCage = 0;

  /** Turns someone waiting at a waypoint toward the way it says to face. */
  const turn = (p, dt) => {
    if (!p.alive || p.wait <= 0 || p.index <= 0 || p.mode !== 'walk') return;
    const wp = p.path[p.index - 1];
    if (!wp || wp.face === undefined) return;
    let diff = wp.face - p.root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    p.root.rotation.y += diff * Math.min(1, dt * 4);
  };

  /** The hoist: leaves when Darrow and his party are aboard, carries whoever is in the cage. */
  const runHoist = (dt) => {
    /** @type {any} Darrow's current stop (route waypoints carry extra fields such as ride). */
    const tw = target.alive && target.index > 0 ? target.path[target.index - 1] : null;
    if (tw && tw.ride !== undefined && target.wait > 0 && inCage(target)) {
      atCage += dt;
      const aboard = companions.every((p) => !p.alive || p.mode !== 'walk' || inCage(p));
      if ((aboard && atCage > (panicked ? 0.2 : 1.2)) || atCage > 7) H.goal = tw.ride;
    } else {
      atCage = 0;
    }
    const moving = Math.abs(H.goal - H.y) > 1e-3;
    if (moving) {
      const step = H.speed * dt;
      H.y += Math.max(-step, Math.min(step, H.goal - H.y));
    }
    if (site.cage) site.cage.position.y = H.y - GROUND_Y;
    for (const p of riders) {
      if (!p.alive || p.mode === 'gone' || !inCage(p)) continue;
      p.root.position.y = H.y;
      p.groundY = H.y;
      /** @type {any} */
      const wp = p.index > 0 ? p.path[p.index - 1] : null;
      const notThere = wp && wp.ride !== undefined && Math.abs(H.y - wp.ride) > 0.01;
      if (moving || notThere) {
        if (p.wait > 0) p.wait = Math.max(p.wait, 0.3);
        else if (moving && (p.mode === 'walk' || p.mode === 'flee')) p.panicDelay = Math.max(p.panicDelay, 0.1);
      }
    }
    return moving;
  };

  return {
    civilians,
    target,
    targetLook,
    contact: foreman,
    exits,
    panicTarget(t) {
      panicked = true;
      H.speed = 2.2;
      const toCar = [{ x: 25.5, z: -292 }, { x: 33.6, z: -287.6 }, { x: SUV_DOOR.x, z: SUV_DOOR.z }];
      /** @type {any[]} */
      let path;
      if (inCage(t) || t.root.position.y > 1) {
        // Up the tower: back to the hoist and down, then run for the car.
        path = inCage(t) ? [] : [{ x: HOIST_TOP_DOOR.x, z: HOIST_TOP_DOOR.z }];
        path.push({ x: cageSpot.x, z: cageSpot.z, wait: 0.4, anim: 'idle', ride: GROUND_Y }, HOIST_GROUND_DOOR, { x: 9, z: -326 }, { x: 15, z: -310 }, ...toCar);
      } else {
        path = t.z < -320 && t.x > 6 ? [{ x: 9, z: -326 }, { x: 15, z: -310 }] : [];
        path.push({ x: 24.5, z: -297.5 }, ...toCar);
      }
      t.path = path;
      t.index = 0;
      t.loop = false;
      t.wait = 0;
      t.speed = 3.6;
      t.mode = 'walk';
      t.panicDelay = 0.3;
    },
    update(dt) {
      site.time += dt;
      animateMachines(site.time);
      const moving = runHoist(dt);
      for (const p of riders) turn(p, dt);
      // The investors listen while he talks, and chat between themselves before.
      const talking = target.alive && target.index === TALK_INDEX + 1 && target.wait > 0;
      investors.forEach((p, i) => {
        if (p.alive && p.mode === 'idle') p.setIdle(talking ? (i ? 'idle2' : 'idle') : i ? 'talk' : 'idle');
      });
      // After the shot: people up the tower run for the stair core, the driver for the car.
      for (const p of civilians) {
        if (p.mode !== 'flee' || settled.has(p)) continue;
        panicked = true;
        if (p === driver) {
          p.path = [{ x: SUV.x + 1.2, z: SUV.z - 1.2 }];
          p.index = 0;
        } else if (riders.includes(p) && inCage(p) && moving) {
          p.panicDelay = Math.max(p.panicDelay, 0.1);
          continue;
        } else if (p.root.position.y > 1) {
          p.path = [{ x: CORE_DOOR.x, z: CORE_DOOR.z }];
          p.index = 0;
        }
        settled.add(p);
      }
    },
    escaped() {
      return target.mode === 'idle' && target.index === target.path.length - 1 &&
        Math.hypot(target.x - SUV_DOOR.x, target.z - SUV_DOOR.z) < 0.6;
    }
  };
}

// ---------- moving machinery ----------

/** Point and heading at distance d along a polyline. */
function along(pts, d) {
  let left = Math.max(0, d);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= l || i === pts.length - 2) {
      const f = Math.min(1, left / l);
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
    }
    left -= l;
  }
  return { x: pts[0].x, z: pts[0].z };
}

function routeLength(pts) {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
  return len;
}

/** Writes the bounding box of a turned w x len footprint into a collider array. */
function footprint(box, x, z, fx, fz, len, w, h) {
  const ex = Math.abs(fx) * len / 2 + Math.abs(fz) * w / 2;
  const ez = Math.abs(fz) * len / 2 + Math.abs(fx) * w / 2;
  box[0] = x - ex;
  box[1] = 0;
  box[2] = z - ez;
  box[3] = x + ex;
  box[4] = h;
  box[5] = z + ez;
}

/**
 * The mixer truck's day: waits outside the west gate, drives in to the pump (parked by t = 20 s,
 * before Darrow stops to watch), pours, reverses out and comes back two minutes later.
 * The forklift shuttles pallets, the site crane slews to and fro.
 */
function animateMachines(t) {
  const m = site.machines;
  if (!m) return;
  if (m.mixer) {
    const pts = MIXER.route;
    const L = routeLength(pts);
    const k = t < 8 ? -1 : (t - 8) % 124;
    const inTime = L / 2.8;
    let d = 0;
    if (k < 0) d = 0;
    else if (k < inTime) d = k * 2.8;
    else if (k < 62) d = L;
    else if (k < 62 + L / 2) d = L - (k - 62) * 2;
    const p = along(pts, d);
    const a = along(pts, Math.min(L - 0.01, Math.max(0, d - 2)));
    const b = along(pts, Math.min(L, d + 2));
    let fx = b.x - a.x;
    let fz = b.z - a.z;
    const n = Math.hypot(fx, fz) || 1;
    fx /= n;
    fz /= n;
    m.mixer.obj.position.set(p.x, 0, p.z);
    m.mixer.obj.rotation.y = Math.atan2(fx, fz);
    footprint(m.mixer.box, p.x, p.z, fx, fz, MIXER.len, MIXER.w, MIXER.h);
  }
  if (m.forklift) {
    const len = Math.abs(FORKLIFT.z1 - FORKLIFT.z0);
    const travel = len / 1.6;
    const k = t % (2 * travel + 10);
    let f = 0;
    if (k < 5) f = 0;
    else if (k < 5 + travel) f = (k - 5) / travel;
    else if (k < 10 + travel) f = 1;
    else f = 1 - (k - 10 - travel) / travel;
    const z = FORKLIFT.z0 + (FORKLIFT.z1 - FORKLIFT.z0) * f;
    m.forklift.obj.position.set(FORKLIFT.x, 0, z);
    footprint(m.forklift.box, FORKLIFT.x, z, 0, 1, 3.9, 1.4, 2.6);
  }
  if (m.crane) m.crane.rotation.y = -Math.PI / 2 + 0.6 * Math.sin((t / 90) * Math.PI * 2);
}

// ---------- set dressing ----------

/** Loads a whole Sketchfab model as one object (null when missing). */
async function whole(name) {
  try {
    const gltf = await loadGLTF(SF + name + '.glb');
    return /** @type {THREE.Object3D} */ (gltf.scene);
  } catch (err) {
    return null;
  }
}

/** Wraps a copy of obj so its footprint is centred on the origin and it stands on y = 0. */
function standUp(obj) {
  const holder = new THREE.Group();
  holder.add(obj);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= box.min.y;
  holder.updateMatrixWorld(true);
  holder.traverse((o) => {
    const mesh = /** @type {any} */ (o);
    if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
  });
  return holder;
}

/** Size of an object as it stands. */
function sizeOf(obj) {
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
}

/**
 * One prop out of a pack whose meshes are named after their prop (e.g. "Traffic_Cone_..."):
 * every mesh whose name starts with prefix, with its world transform, stood on the ground.
 * Kept at the pack's own scale when that is plausible, otherwise scaled to `expected` metres
 * (its longest horizontal side).
 */
function pickProp(root, prefix, expected) {
  if (!root) return null;
  root.updateMatrixWorld(true);
  const g = new THREE.Group();
  root.traverse((o) => {
    const mesh = /** @type {any} */ (o);
    if (!mesh.isMesh) return;
    const name = mesh.name || '';
    const parent = (mesh.parent && mesh.parent.name) || '';
    if (!name.startsWith(prefix) && !parent.startsWith(prefix)) return;
    const c = mesh.clone(false);
    mesh.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    g.add(c);
  });
  if (!g.children.length) return null;
  const holder = standUp(g);
  const s = sizeOf(holder);
  const long = Math.max(s.x, s.z) || 1;
  if (long < expected / 2 || long > expected * 2) holder.scale.setScalar(expected / long);
  holder.updateMatrixWorld(true);
  return holder;
}

/** Collects boxes per material and merges them: a handful of draw calls for all of it. */
function merger() {
  /** @type {Map<THREE.Material, THREE.BufferGeometry[]>} */
  const lists = new Map();
  const add = (mat, g) => {
    if (!lists.has(mat)) lists.set(mat, []);
    lists.get(mat).push(g);
  };
  /**
   * A box centred on (x, y, z), size w x h x d, turned rotY; `tile` > 0 gives world-metre UVs
   * (one texture tile per `tile` metres across, `tileY` metres up the walls).
   * @param {THREE.Material} mat
   */
  const box = (mat, x, y, z, w, h, d, rotY = 0, tile = 0, tileY = tile) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (tile) {
      const pos = g.attributes.position;
      const nor = g.attributes.normal;
      const uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i) + x;
        const py = pos.getY(i) + y;
        const pz = pos.getZ(i) + z;
        if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, px / tile, pz / tile);
        else if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, pz / tile, py / tileY);
        else uv.setXY(i, px / tile, py / tileY);
      }
    }
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    add(mat, g);
  };
  /** A box between two corners. */
  const span = (mat, x0, y0, z0, x1, y1, z1, tile = 0, tileY = tile) =>
    box(mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 0, tile, tileY);
  /** A thin bar from point a to point b. */
  const bar = (mat, a, b, t) => {
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    const g = new THREE.BoxGeometry(t, len, t);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    add(mat, g);
  };
  const cylinder = (mat, x, y, z, rTop, rBottom, h, seg = 12) => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
    g.translate(x, y, z);
    add(mat, g);
  };
  /**
   * Merges everything into `parent`; meshes of materials in `skipRange` are not measured by the
   * rangefinder and those in `noShadow` cast none.
   * @param {THREE.Object3D} parent
   * @param {THREE.Object3D[]} rangeMeshes
   * @param {{ noShadow?: THREE.Material[], skipRange?: THREE.Material[] }} [opts]
   */
  const build = (parent, rangeMeshes, opts = {}) => {
    for (const [mat, list] of lists) {
      const geo = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = !(opts.noShadow && opts.noShadow.includes(mat));
      mesh.receiveShadow = true;
      parent.add(mesh);
      if (!(opts.skipRange && opts.skipRange.includes(mat))) rangeMeshes.push(mesh);
    }
    lists.clear();
  };
  return { box, span, bar, cylinder, build };
}

/**
 * Set dressing for the site: gravel yard, hoarding and gates, the half-built tower with its
 * hoist, scaffolding and formwork, the site office, materials, machines, both tower cranes and
 * the SUV. Sketchfab models where present, simple shapes otherwise.
 * @param {THREE.Scene} _scene
 */
export async function constructionDress(_scene) {
  const [craneSrc, mixerSrc, excavatorSrc, propsSrc, scaffoldSrc, carSrc, forkliftSrc, materials] = await Promise.all([
    whole('tower_crane'), whole('mixer_truck'), whole('excavator'), whole('construction_props'),
    whole('scaffolding'), whole('car_pack'), whole('forklift'), loadPack('site_materials')
  ]);
  const group = new THREE.Group();
  group.name = 'construction-dressing';
  const colliders = siteColliders().map((b) => b.slice());
  /** @type {THREE.Object3D[]} */
  const rangeMeshes = [];
  const meshesOf = (obj) => obj.traverse((o) => {
    if (/** @type {any} */ (o).isMesh) rangeMeshes.push(o);
  });

  const mats = {
    gravel: new THREE.MeshStandardMaterial({ map: gravelTexture(), roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.92 }),
    plywood: new THREE.MeshStandardMaterial({ color: '#b98d55', roughness: 0.85 }),
    steel: new THREE.MeshStandardMaterial({ color: '#5d656d', roughness: 0.5, metalness: 0.55 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#e0a817', roughness: 0.6, metalness: 0.2 }),
    hoarding: new THREE.MeshStandardMaterial({ map: hoardingTexture(), roughness: 0.8 }),
    rebar: new THREE.MeshStandardMaterial({ color: '#6e4a33', roughness: 0.7, metalness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: '#202428', roughness: 0.6 }),
    cabin: new THREE.MeshStandardMaterial({ color: '#dfe2e3', roughness: 0.7 }),
    dirt: new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 1 }),
    mesh: new THREE.MeshStandardMaterial({ map: wireTexture(), color: '#c9cdd0', transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 })
  };
  const tex = (m, rx, ry) => {
    const t = /** @type {THREE.Texture} */ (m.map);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
  };
  tex(mats.gravel, 1, 1);
  tex(mats.concrete, 1, 1);
  tex(mats.hoarding, 1, 1);
  const M = merger();

  // ---------- ground: the gravel yard and a pad under the vantage crane ----------
  M.span(mats.gravel, SITE.x0, 0, SITE.z0, SITE.x1, GROUND_Y, SITE.z1, 8);
  M.span(mats.gravel, CRANE.x - 14, 0, CRANE.z - 14, CRANE.x + 14, GROUND_Y, CRANE.z + 14, 8);
  // Spoil heap from the foundation pit.
  M.cylinder(mats.dirt, HEAP.x, HEAP.h / 2, HEAP.z, HEAP.r * 0.35, HEAP.r, HEAP.h, 10);

  // ---------- the tower: slabs, columns, core, formwork, rebar, edge protection ----------
  const T = TOWER;
  M.span(mats.concrete, T.x0, 0, T.z0, T.x1, FLOORS[0], T.z1, 4);
  for (let i = 1; i < FLOORS.length; i++) M.span(mats.concrete, T.x0, FLOORS[i] - SLAB, T.z0, T.x1, FLOORS[i], T.z1, 4);
  const inCore = (x, z) => x > CORE.x0 - 0.3 && z < CORE.z1 + 0.3;
  for (let i = 0; i < FLOORS.length - 1; i++) {
    const y0 = FLOORS[i];
    const y1 = FLOORS[i + 1] - SLAB;
    for (const x of GRID_X) {
      for (const z of GRID_Z) if (!inCore(x, z)) M.box(mats.concrete, x, (y0 + y1) / 2, z, COLUMN, y1 - y0, COLUMN, 0, 2);
    }
  }
  M.span(mats.concrete, CORE.x0, 0, CORE.z0, CORE.x1, CORE.h, CORE.z1, 4);
  for (const y of FLOORS) M.span(mats.dark, CORE_DOOR.x - 0.55, y, CORE.z1, CORE_DOOR.x + 0.55, y + 2.1, CORE.z1 + 0.04);
  for (const x of GRID_X) {
    for (const z of GRID_Z) {
      if (inCore(x, z)) continue;
      if (x >= FORMWORK_X) {
        M.box(mats.plywood, x, TOP + FORMWORK_H / 2, z, 0.7, FORMWORK_H, 0.7);
        // Props bracing the formwork.
        M.bar(mats.steel, [x - 0.35, TOP + 2.4, z], [x - 1.9, TOP, z], 0.06);
      } else {
        for (const [dx, dz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
          M.box(mats.rebar, x + dx, TOP + 0.5, z + dz, 0.03, 1.0, 0.03);
        }
      }
    }
  }
  // Edge protection on every floor: posts, two rails and a toe board (west, south and north),
  // open on the west side where the hoist cage docks.
  for (let i = 1; i < FLOORS.length; i++) {
    const y = FLOORS[i];
    const edge = (x0, z0, x1, z1, gap) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 2.5));
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n;
        const z = z0 + ((z1 - z0) * k) / n;
        if (gap && z > gap[0] - 0.2 && z < gap[1] + 0.2) continue;
        M.box(mats.yellow, x, y + 0.55, z, 0.06, 1.1, 0.06);
      }
      const runs = gap ? [[z0, gap[0]], [gap[1], z1]] : [[0, 1]];
      for (const [a, b] of runs) {
        const p0 = gap ? { x: x0, z: a } : { x: x0, z: z0 };
        const p1 = gap ? { x: x1, z: b } : { x: x1, z: z1 };
        for (const h of [0.5, 1.05]) M.bar(mats.yellow, [p0.x, y + h, p0.z], [p1.x, y + h, p1.z], 0.045);
        M.bar(mats.plywood, [p0.x, y + 0.08, p0.z], [p1.x, y + 0.08, p1.z], 0.15);
      }
    };
    const gap = [HOIST.z - HOIST.d / 2, HOIST.z + HOIST.d / 2];
    edge(T.x0 + 0.05, T.z0, T.x0 + 0.05, T.z1, gap);
    edge(T.x0, T.z1 - 0.05, T.x1, T.z1 - 0.05, null);
    edge(T.x0, T.z0 + 0.05, CORE.x0, T.z0 + 0.05, null);
  }

  // ---------- the hoist: mast on the west face and the cage that rides it ----------
  const mx = HOIST.mastX;
  const mz = HOIST.z;
  for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
    M.box(mats.steel, mx + dx, HOIST.top / 2, mz + dz, 0.08, HOIST.top, 0.08);
  }
  for (let y = 0.75; y < HOIST.top; y += 1.5) {
    M.bar(mats.steel, [mx - 0.3, y, mz - 0.3], [mx - 0.3, y + 1.5, mz + 0.3], 0.04);
    M.bar(mats.steel, [mx + 0.3, y, mz + 0.3], [mx + 0.3, y + 1.5, mz - 0.3], 0.04);
    M.box(mats.steel, mx, y, mz - 0.3, 0.6, 0.04, 0.04);
    M.box(mats.steel, mx, y, mz + 0.3, 0.6, 0.04, 0.04);
  }
  // Ties from the mast to each floor slab, north of the cage's shaft.
  const tieZ = HOIST.z - HOIST.d / 2 - 0.6;
  for (let i = 1; i < FLOORS.length; i++) {
    const y = FLOORS[i] - 0.15;
    M.bar(mats.steel, [mx, y, mz - 0.3], [mx, y, tieZ], 0.08);
    M.bar(mats.steel, [mx, y, tieZ], [T.x0, y, tieZ], 0.08);
  }
  const cage = new THREE.Group();
  cage.name = 'hoist-cage';
  {
    const C = merger();
    const x0 = HOIST.x - HOIST.w / 2;
    const x1 = HOIST.x + HOIST.w / 2;
    const z0 = HOIST.z - HOIST.d / 2;
    const z1 = HOIST.z + HOIST.d / 2;
    C.span(mats.yellow, x0, GROUND_Y - 0.12, z0, x1, GROUND_Y, z1);
    C.span(mats.yellow, x0, GROUND_Y + 2.3, z0, x1, GROUND_Y + 2.38, z1);
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) C.box(mats.yellow, x, GROUND_Y + 1.15, z, 0.08, 2.3, 0.08);
    // Mesh walls on the mast (west) side and the north side; the south door and the east
    // landing gate stand open.
    C.span(mats.mesh, x0, GROUND_Y + 0.1, z0, x0 + 0.02, GROUND_Y + 2.25, z1);
    C.span(mats.mesh, x0, GROUND_Y + 0.1, z0, x1, GROUND_Y + 2.25, z0 + 0.02);
    for (const h of [1.05]) {
      C.span(mats.yellow, x0, GROUND_Y + h, z1 - 0.03, x0 + 0.5, GROUND_Y + h + 0.05, z1);
      C.span(mats.yellow, x1 - 0.03, GROUND_Y + h, z0, x1, GROUND_Y + h + 0.05, z0 + 0.4);
    }
    C.build(cage, rangeMeshes, { skipRange: [mats.mesh], noShadow: [mats.mesh] });
  }
  group.add(cage);
  site.cage = cage;
  cage.position.y = site.hoist.y - GROUND_Y;

  // ---------- hoarding with gates ----------
  const S = SITE;
  const t = 0.12;
  M.span(mats.hoarding, S.x0, 0, S.z1 - t, SOUTH_GATE.x0, S.h, S.z1, 12, S.h);
  M.span(mats.hoarding, SOUTH_GATE.x1, 0, S.z1 - t, S.x1, S.h, S.z1, 12, S.h);
  M.span(mats.hoarding, S.x0, 0, S.z0, S.x1, S.h, S.z0 + t, 12, S.h);
  M.span(mats.hoarding, S.x1 - t, 0, S.z0, S.x1, S.h, S.z1, 12, S.h);
  M.span(mats.hoarding, S.x0, 0, S.z0, S.x0 + t, S.h, WEST_GATE.z0, 12, S.h);
  M.span(mats.hoarding, S.x0, 0, WEST_GATE.z1, S.x0 + t, S.h, S.z1, 12, S.h);
  // Gate leaves swung open into the yard: steel frames with mesh.
  const leaf = (hx, hz, ux, uz, len) => {
    const ex = hx + ux * len;
    const ez = hz + uz * len;
    M.bar(mats.steel, [hx, 0.1, hz], [ex, 0.1, ez], 0.06);
    M.bar(mats.steel, [hx, 2.2, hz], [ex, 2.2, ez], 0.06);
    M.bar(mats.steel, [hx, 0.1, hz], [hx, 2.2, hz], 0.06);
    M.bar(mats.steel, [ex, 0.1, ez], [ex, 2.2, ez], 0.06);
    M.span(mats.mesh, Math.min(hx, ex), 0.12, Math.min(hz, ez), Math.max(hx, ex) + (ux ? 0 : 0.02), 2.18, Math.max(hz, ez) + (uz ? 0 : 0.02));
  };
  leaf(SOUTH_GATE.x0, S.z1 - 0.2, 0, -1, 5.4);
  leaf(SOUTH_GATE.x1, S.z1 - 0.2, 0, -1, 5.4);
  leaf(S.x0 + 0.2, WEST_GATE.z0, 1, 0, 4.4);
  leaf(S.x0 + 0.2, WEST_GATE.z1, 1, 0, 4.4);

  // ---------- site office: containers (Sketchfab site container, or plain cabins) ----------
  const container = pickProp(propsSrc, 'Construction_Site_Container', 6.1);
  const ox0 = OFFICE.x0;
  const half = (OFFICE.x1 - OFFICE.x0) / 2;
  const officeSpots = [
    { x: ox0 + half / 2, z: (OFFICE.z0 + OFFICE.z1) / 2, y: 0 },
    { x: ox0 + half * 1.5, z: (OFFICE.z0 + OFFICE.z1) / 2, y: 0 },
    { x: ox0 + half / 2, z: (OFFICE.z0 + OFFICE.z1) / 2, y: OFFICE.h }
  ];
  if (container) {
    const sz = sizeOf(container);
    const rot = sz.z > sz.x ? Math.PI / 2 : 0;
    const s = (half - 0.1) / Math.max(sz.x, sz.z);
    officeSpots[2].y = sz.y * s;
    const set = instancePart(group, container, officeSpots.map((p) => ({ ...p, rot, s: s * container.scale.x })));
    if (set) meshesOf(set);
  } else {
    for (const p of officeSpots) {
      M.box(mats.cabin, p.x, p.y + OFFICE.h / 2, p.z, half - 0.1, OFFICE.h, OFFICE.z1 - OFFICE.z0, 0);
      M.span(mats.dark, p.x - half / 2 + 0.6, p.y + 1.0, OFFICE.z0 - 0.03, p.x + half / 2 - 0.6, p.y + 1.9, OFFICE.z0);
    }
  }
  // Stairs up to the upper cabin, on its west end.
  for (let k = 0; k < 9; k++) M.box(mats.steel, OFFICE.x0 - 0.6, 0.15 + k * 0.29, OFFICE.z0 + 0.1 + k * 0.25, 1.0, 0.05, 0.28);
  M.bar(mats.steel, [OFFICE.x0 - 1.1, 1.0, OFFICE.z0], [OFFICE.x0 - 1.1, OFFICE.h + 1.0, OFFICE.z1], 0.05);

  // ---------- materials: concrete pipes, planks, cement pallets (Sketchfab or boxes) ----------
  const part = (name) => materials && materials.parts.get(name);
  const kinds = [part('Concrete_Pipe2'), part('Planks'), part('Pallet1002'), part('Concrete_Pipe2'), part('Pallet1002')];
  /** @type {Map<THREE.Object3D, any[]>} */
  const stackSpots = new Map();
  STACKS.forEach(([x, z, w, d, h], i) => {
    const p = kinds[i];
    if (p) {
      const sz = sizeOf(p);
      const rot = (sz.x > sz.z) === (w > d) ? 0 : Math.PI / 2;
      if (!stackSpots.has(p)) stackSpots.set(p, []);
      stackSpots.get(p).push({ x, z, rot, s: Math.min(1.3, Math.max(0.6, h / sz.y)) });
    } else {
      M.box(i === 1 ? mats.plywood : mats.concrete, x, h / 2, z, w, h, d, 0, 2);
    }
  });
  for (const [p, spots] of stackSpots) {
    const set = instancePart(group, p, spots);
    if (set) meshesOf(set);
  }

  // ---------- small props from the construction pack ----------
  const props = [
    ['Concrete_Barrier', 2.0, [[22, -297, 0], [29, -297, 0], [-14.6, -303.5, Math.PI / 2], [-14.6, -316.5, Math.PI / 2]]],
    ['Traffic_Cone', 0.45, [[20.6, -290.2, 0], [30.4, -290.2, 0], [9.2, -331.6, 0], [11.9, -331.6, 0], [-4.2, -316.4, 0], [-1.2, -316.6, 0]]],
    ['Diesel_Generator', 2.4, [[16.8, -295.4, 0]]],
    ['Armature_Bundle', 4.5, [[30.5, -340.5, 0, TOP], [30.5, -336.5, 0, TOP], [24.0, -348.5, Math.PI / 2, TOP]]],
    ['Brick_Pile', 1.3, [[16, -319.5, 0], [19, -319.5, 0], [-12, -330, 0]]],
    ['Wheelbarrow', 1.5, [[2.8, -323.2, 0.7], [27.5, -333, 2.0, TOP]]]
  ];
  for (const [name, size, spots] of /** @type {any[]} */ (props)) {
    const p = pickProp(propsSrc, name, size);
    if (!p) continue;
    const set = instancePart(group, p, spots.map(([x, z, rot, y]) => ({ x, z, rot, y: y || GROUND_Y, s: p.scale.x })));
    if (set) meshesOf(set);
  }

  // ---------- scaffolding: west face (north half) and the south face ----------
  const scaffold = scaffoldSrc ? standUp(scaffoldSrc.clone(true)) : null;
  if (scaffold) {
    const sz = sizeOf(scaffold);
    const long = Math.max(sz.x, sz.z);
    const turned = sz.z > sz.x;
    /** @type {any[]} */
    const spots = [];
    // Two bays of 6.5 m from the north corner of the west face, three lifts high.
    const sw = 6.5 / long;
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 2; k++) spots.push({ x: T.x0 - 0.75, z: T.z0 + 3.25 + k * 6.5, y: row * sz.y * sw, rot: turned ? 0 : Math.PI / 2, s: sw });
    }
    const ss = 7.5 / long;
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 4; k++) spots.push({ x: T.x0 + 3.75 + k * 7.5, z: T.z1 + 0.75, y: row * sz.y * ss, rot: turned ? Math.PI / 2 : 0, s: ss });
    }
    instancePart(group, scaffold, spots);
  } else {
    const tube = (x0, z0, x1, z1, top) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.round(len / 2.5);
      const nx = -(z1 - z0) / len;
      const nz = (x1 - x0) / len;
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n;
        const z = z0 + ((z1 - z0) * k) / n;
        for (const off of [0, 0.75]) M.box(mats.steel, x + nx * off, top / 2, z + nz * off, 0.05, top, 0.05);
      }
      for (let y = 2; y <= top; y += 2) {
        for (const off of [0, 0.75]) M.bar(mats.steel, [x0 + nx * off, y, z0 + nz * off], [x1 + nx * off, y, z1 + nz * off], 0.05);
        M.bar(mats.plywood, [x0 + nx * 0.37, y - 0.05, z0 + nz * 0.37], [x1 + nx * 0.37, y - 0.05, z1 + nz * 0.37], 0.7);
      }
    };
    tube(T.x0 - 0.3, T.z0 + 13, T.x0 - 0.3, T.z0, 16);
    tube(T.x0, T.z1 + 0.3, T.x1, T.z1 + 0.3, 16);
  }

  // ---------- machines ----------
  /** @type {any} */
  const machines = {};
  // Mixer truck: Sketchfab model (nose along +z) or a simple truck.
  const mixer = new THREE.Group();
  if (mixerSrc) {
    const m = standUp(mixerSrc.clone(true));
    const sz = sizeOf(m);
    m.scale.setScalar(MIXER.len / Math.max(sz.x, sz.z));
    if (sz.x > sz.z) m.rotation.y = -Math.PI / 2;
    mixer.add(m);
  } else {
    const V = merger();
    const truckRed = new THREE.MeshStandardMaterial({ color: '#9c2a22', roughness: 0.45, metalness: 0.3 });
    V.box(mats.dark, 0, 0.75, 0, 2.4, 0.5, 8.6);
    V.box(truckRed, 0, 1.8, 3.2, 2.4, 1.9, 1.9);
    V.box(mats.dark, 0, 2.2, 4.16, 2.1, 0.8, 0.05);
    const drum = new THREE.CylinderGeometry(0.95, 1.25, 4.6, 16);
    drum.rotateX(Math.PI / 2 - 0.2);
    drum.translate(0, 2.35, -1.2);
    const drumMesh = new THREE.Mesh(drum, mats.steel);
    drumMesh.castShadow = true;
    mixer.add(drumMesh);
    for (const z of [3.0, -1.6, -3.0]) for (const x of [-1.1, 1.1]) V.cylinder(mats.dark, x, 0.5, z, 0.5, 0.5, 0.35);
    V.build(mixer, rangeMeshes);
  }
  meshesOf(mixer);
  group.add(mixer);
  const mixerBox = [0, 0, 0, 0, 0, 0];
  colliders.push(mixerBox);
  machines.mixer = { obj: mixer, box: mixerBox };

  // Forklift shuttling pallets.
  const forklift = new THREE.Group();
  if (forkliftSrc) {
    const f = standUp(forkliftSrc.clone(true));
    const sz = sizeOf(f);
    f.scale.setScalar(3.4 / Math.max(sz.x, sz.z));
    if (sz.x > sz.z) f.rotation.y = Math.PI / 2;
    forklift.add(f);
  } else {
    const V = merger();
    V.box(mats.yellow, 0, 0.9, 0, 1.2, 1.2, 2.0);
    V.box(mats.steel, 0, 1.6, 1.15, 0.9, 3.2, 0.1);
    V.box(mats.plywood, 0, 0.35, 1.7, 1.1, 0.5, 1.0);
    V.build(forklift, rangeMeshes);
  }
  meshesOf(forklift);
  group.add(forklift);
  const forkBox = [0, 0, 0, 0, 0, 0];
  colliders.push(forkBox);
  machines.forklift = { obj: forklift, box: forkBox };

  // Excavator at the foundation pit (static).
  if (excavatorSrc) {
    const e = standUp(excavatorSrc.clone(true));
    const sz = sizeOf(e);
    e.scale.setScalar(EXCAVATOR.len / Math.max(sz.x, sz.z));
    if (sz.z > sz.x) e.rotation.y = Math.PI / 2;
    e.position.set(EXCAVATOR.x, GROUND_Y, EXCAVATOR.z);
    group.add(e);
    meshesOf(e);
  } else {
    M.box(mats.yellow, EXCAVATOR.x + 1.5, 1.9, EXCAVATOR.z, 3.6, 1.6, 2.8);
    M.box(mats.dark, EXCAVATOR.x + 1.5, 0.5, EXCAVATOR.z, 4.4, 1.0, 3.1);
    M.bar(mats.yellow, [EXCAVATOR.x, 2.4, EXCAVATOR.z], [EXCAVATOR.x - 3.2, 4.6, EXCAVATOR.z], 0.45);
    M.bar(mats.yellow, [EXCAVATOR.x - 3.2, 4.6, EXCAVATOR.z], [EXCAVATOR.x - 5.4, 1.0, EXCAVATOR.z], 0.35);
  }

  // ---------- the two tower cranes ----------
  const craneModel = craneSrc ? standUp(craneSrc.clone(true)) : null;
  /** The crane model's mast centre and slewing-platform deck height, in the stood-up model. */
  let mast = { x: 0, z: 0 };
  let deck = CRANE.deck;
  if (craneModel) {
    const node = (n) => craneModel.getObjectByName(n);
    const mastNode = node('Cube052');
    const deckNode = node('Cube100');
    if (mastNode) {
      const b = new THREE.Box3().setFromObject(mastNode);
      mast = { x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2 };
    }
    if (deckNode) deck = new THREE.Box3().setFromObject(deckNode).max.y;
  }
  // Vantage crane: scaled so its deck is exactly where the shooter stands.
  if (craneModel) {
    const v = craneModel.clone(true);
    const s = Math.min(1.25, Math.max(0.8, CRANE.deck / deck));
    v.scale.setScalar(s);
    v.position.set(CRANE.x - mast.x * s, 0, CRANE.z - mast.z * s);
    // Not measured by the rangefinder: the shooter stands inside it.
    group.add(v);
  } else {
    proceduralCrane(M, mats, CRANE.x, CRANE.z, CRANE.deck, 0);
  }
  // Without the model: a deck and the front rail the shooter leans on (the model has its own;
  // the rail's collider is always there, see construction-layout.js).
  if (!craneModel) {
    M.span(mats.steel, RAIL.x - 0.02, RAIL.top - 0.05, RAIL.z0, RAIL.x + 0.02, RAIL.top, RAIL.z1);
    M.span(mats.steel, RAIL.x - 0.02, CRANE.deck + 0.5, RAIL.z0, RAIL.x + 0.02, CRANE.deck + 0.54, RAIL.z1);
    M.span(mats.steel, CRANE.x - 2, CRANE.deck - 0.2, CRANE.z - 5.5, RAIL.x, CRANE.deck, RAIL.z1);
  }
  // Site crane north of the tower, slewing over it.
  const pivot = new THREE.Group();
  pivot.position.set(SITE_CRANE.x, 0, SITE_CRANE.z);
  if (craneModel) {
    const c = craneModel.clone(true);
    c.position.set(-mast.x, 0, -mast.z);
    pivot.add(c);
  } else {
    const P = merger();
    proceduralCrane(P, mats, 0, 0, 40, 0);
    P.build(pivot, rangeMeshes);
  }
  meshesOf(pivot);
  group.add(pivot);
  machines.crane = pivot;

  // ---------- the SUV ----------
  const suv = buildSuv(carSrc) || simpleSuv(mats);
  suv.position.set(SUV.x, 0, SUV.z);
  group.add(suv);
  meshesOf(suv);
  site.suv = suv;
  site.suvHome.copy(suv.position);

  M.build(group, rangeMeshes, { skipRange: [mats.mesh], noShadow: [mats.mesh, mats.gravel] });
  site.machines = machines;
  animateMachines(site.time);
  return { group, colliders, rangeMeshes };
}

/** A plain tower crane: lattice mast, slewing deck with cab, jib along +x, counter-jib. */
function proceduralCrane(M, mats, x, z, deckY, _rot) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.box(mats.yellow, x + dx, deckY / 2, z + dz, 0.15, deckY, 0.15);
  for (let y = 1; y < deckY - 1; y += 2) {
    M.bar(mats.yellow, [x - 1, y, z - 1], [x + 1, y + 2, z - 1], 0.08);
    M.bar(mats.yellow, [x + 1, y, z + 1], [x - 1, y + 2, z + 1], 0.08);
    M.bar(mats.yellow, [x - 1, y, z + 1], [x - 1, y + 2, z - 1], 0.08);
    M.bar(mats.yellow, [x + 1, y, z - 1], [x + 1, y + 2, z + 1], 0.08);
  }
  M.box(mats.cabin, x + 2.3, deckY + 1.3, z - 4.2, 2.4, 2.6, 2.4);
  M.box(mats.yellow, x + 0.4, deckY + 4.5, z, 1.6, 9, 1.6);
  const jy = deckY + 4;
  M.bar(mats.yellow, [x + 1, jy, z - 0.9], [x + 38, jy, z - 0.9], 0.12);
  M.bar(mats.yellow, [x + 1, jy, z + 0.9], [x + 38, jy, z + 0.9], 0.12);
  M.bar(mats.yellow, [x + 1, jy + 1.6, z], [x + 38, jy + 0.4, z], 0.12);
  for (let k = 0; k < 18; k++) {
    const a = x + 1 + k * 2;
    M.bar(mats.yellow, [a, jy, z - 0.9], [a + 2, jy + 1.5 - k * 0.06, z], 0.06);
    M.bar(mats.yellow, [a, jy, z + 0.9], [a + 2, jy + 1.5 - k * 0.06, z], 0.06);
  }
  M.box(mats.yellow, x - 7, jy + 0.3, z, 13, 0.6, 2.2);
  M.box(mats.concrete, x - 11.5, jy - 1, z, 2, 2.4, 2);
}

/**
 * Darrow's SUV from the generic car pack: the "SUV Body" part with its four wheels, turned so
 * its nose points east (+x). The nose is told from the roof, which sits nearer the tail.
 * @param {THREE.Object3D | null} src
 */
function buildSuv(src) {
  if (!src) return null;
  src.updateMatrixWorld(true);
  /** @type {any} */
  let body = null;
  src.traverse((o) => {
    if (!body && /^SUV[_ ]?Body/i.test(o.name)) body = o;
  });
  if (!body) return null;
  const bodyBox = new THREE.Box3().setFromObject(body);
  const centre = bodyBox.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  const take = (o) => {
    const c = o.clone(true);
    o.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    c.position.sub(centre);
    g.add(c);
  };
  take(body);
  src.traverse((o) => {
    if (!/^Wheel/i.test(o.name) || o === body) return;
    const b = new THREE.Box3().setFromObject(o);
    if (b.getCenter(new THREE.Vector3()).distanceTo(centre) < 2.4 && !(o.parent && /^Wheel/i.test(o.parent.name))) take(o);
  });
  // Long axis and nose from the body's vertices (horizontal principal axis; roof toward the tail).
  const baked = bakeByMaterial(g);
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  let n = 0;
  let top = -Infinity;
  for (const geo of baked.values()) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      sxx += x * x;
      szz += z * z;
      sxz += x * z;
      top = Math.max(top, pos.getY(i));
      n++;
    }
  }
  if (!n) return null;
  const angle = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  let ax = Math.cos(angle);
  let az = Math.sin(angle);
  let roof = 0;
  let roofN = 0;
  for (const geo of baked.values()) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < top - 0.25) continue;
      roof += pos.getX(i) * ax + pos.getZ(i) * az;
      roofN++;
    }
    geo.dispose();
  }
  if (roofN && roof / roofN > 0) {
    ax = -ax;
    az = -az;
  }
  // Black paint on the body.
  g.traverse((o) => {
    const mesh = /** @type {any} */ (o);
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
    if (!/^SUV/i.test(mesh.name) && !(mesh.parent && /^SUV/i.test(mesh.parent.name))) return;
    const paint = (m) => {
      if (!m || /glass|window|light|lamp|chrome|tire|tyre|rubber|wheel|rim/i.test(m.name || '')) return m;
      const c = m.clone();
      if (c.color) c.color.multiplyScalar(m.map ? 0.28 : 0).add(new THREE.Color(m.map ? '#000000' : '#16181b'));
      if ('metalness' in c) c.metalness = 0.5;
      if ('roughness' in c) c.roughness = 0.3;
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(paint) : paint(mesh.material);
  });
  const holder = new THREE.Group();
  const inner = standUp(g);
  inner.rotation.y = Math.atan2(az, ax);
  holder.add(inner);
  // Fit to the expected length.
  const sz = sizeOf(holder);
  const long = Math.max(sz.x, sz.z) || 1;
  if (long < SUV.len * 0.6 || long > SUV.len * 1.5) inner.scale.setScalar(SUV.len / long);
  return holder;
}

/** A plain black SUV. */
function simpleSuv(mats) {
  const g = new THREE.Group();
  const V = merger();
  const paint = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.3, metalness: 0.5 });
  V.box(paint, 0, 0.85, 0, SUV.len, 0.8, SUV.w);
  V.box(paint, -0.3, 1.5, 0, SUV.len * 0.62, 0.6, SUV.w - 0.1);
  V.box(mats.dark, -0.3, 1.5, 0, SUV.len * 0.6, 0.5, SUV.w - 0.06);
  for (const [x, z] of [[1.5, -0.85], [1.5, 0.85], [-1.5, -0.85], [-1.5, 0.85]]) {
    const w = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14);
    w.rotateX(Math.PI / 2);
    w.translate(x, 0.38, z);
    const m = new THREE.Mesh(w, mats.dark);
    m.castShadow = true;
    g.add(m);
  }
  V.build(g, []);
  return g;
}

/** Puts the SUV back after a contract in which Darrow drove off. */
export function constructionReset() {
  if (site.suv) site.suv.position.copy(site.suvHome);
}

/** Darrow got in: his driver too, and the SUV pulls away east along the road. */
export function constructionEscape(dt, t) {
  const d = site.driver;
  if (d && d.alive && d.mode !== 'gone') {
    d.mode = 'gone';
    d.root.visible = false;
  }
  if (site.suv && t > 0.6) site.suv.position.x += dt * Math.min(12, (t - 0.6) * 5);
}

// ---------- textures (procedural, small) ----------

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Grey-brown compacted gravel with tyre ruts (one tile = 8 m). */
function gravelTexture() {
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#7d766b';
    g.fillRect(0, 0, w, h);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2600; i++) {
      const v = 90 + rnd() * 70;
      g.fillStyle = `rgba(${v | 0},${(v * 0.95) | 0},${(v * 0.86) | 0},0.55)`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    g.fillStyle = 'rgba(60,52,44,0.22)';
    for (const x of [70, 96, 170, 196]) g.fillRect(x, 0, 12, h);
  });
}

/** Fresh grey concrete with faint board marks (one tile = 4 m). */
function concreteTexture() {
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#a9a7a0';
    g.fillRect(0, 0, w, h);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1800; i++) {
      const v = 150 + rnd() * 50;
      g.fillStyle = `rgba(${v | 0},${v | 0},${(v * 0.97) | 0},0.35)`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 1 + rnd() * 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 1);
  });
}

/** Painted site hoarding with the developer's banner (one tile = 12 m along, full height). */
function hoardingTexture() {
  return canvas(1024, 205, (g, w, h) => {
    g.fillStyle = '#23382f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < w; x += 104) g.fillRect(x, 0, 3, h);
    g.fillStyle = '#e9e4d8';
    g.fillRect(0, 22, w, 6);
    g.fillRect(0, h - 26, w, 6);
    g.fillStyle = '#e9e4d8';
    g.font = 'bold 58px "Rajdhani", "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.fillText('NORTHGATE RESIDENCES', w / 2, 108);
    g.font = '600 30px "Inter", sans-serif';
    g.fillStyle = '#c9a45c';
    g.fillText('A DARROW DEVELOPMENTS PROJECT', w / 2, 150);
  });
}

/** Steel mesh for gates and the hoist cage: a grid with see-through holes. */
function wireTexture() {
  const t = canvas(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < w; i += 8) {
      g.fillRect(i, 0, 2, h);
      g.fillRect(0, i, w, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}
