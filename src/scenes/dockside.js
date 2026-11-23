// @ts-check
// Contract 02, Dockside: sunset on the container pier. Anton Breg arrives in a dark van,
// checks an open container of cash with the dock foreman, then walks along the north edge of
// the pier to the moored ship and climbs the gangway. Two bodyguards stay at his shoulders.
//
// Line of sight: the container stacks are one solid collider (x 168-290, z -320 to -164, 11 m
// high), so everything Breg does happens on the open north strip of the pier (z -150 to -165)
// and the apron by the ship, which the warehouse roof at (119, 19.7, -100) can see.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGLTF, placeProp } from '../assets.js';

/** Pier deck height and the ship's deck. */
const PIER_Y = 0;
const PROMENADE_Y = 0.15;
const DECK_Y = 9;

/** The ship's gangway: from the apron up to the stern deck, along +x at z = -166. */
const GANGWAY = { x0: 322, x1: 337, z: -166, top: DECK_Y };

/** The open container (long axis along x, doors at the west end). */
const BOX = { x0: 229.5, x1: 241.7, z0: -159.4, z1: -157.0, h: 2.6 };

/** The van Breg arrives in. */
const VAN = { x: 199.8, z: -155.6, len: 5.2, w: 2.0, h: 2.2 };

/** Target avatar and the avatars nobody else on the pier uses. */
const BREG = 'Male_Adult_17';
const GUARDS = ['Male_Adult_04', 'Male_Adult_07'];
const FOREMAN = 'Male_Adult_12';
const WORKERS = ['Male_Adult_05', 'Male_Adult_10', 'Male_Adult_11', 'Male_Adult_12', 'Male_Adult_20'];
const WORKERS_F = ['Female_Adult_02', 'Female_Adult_11'];

/** Ground height on the gangway for someone at (x, z), or null when they are not on it. */
function gangwayY(x, z) {
  if (Math.abs(z - GANGWAY.z) > 1.4) return null;
  if (x >= GANGWAY.x0 && x <= GANGWAY.x1) return ((x - GANGWAY.x0) / (GANGWAY.x1 - GANGWAY.x0)) * GANGWAY.top;
  if (x > GANGWAY.x1 && x < GANGWAY.x1 + 6) return GANGWAY.top;
  return null;
}

/**
 * @param {import('../people.js').CrowdKit} kit
 * @returns {import('../people.js').CrowdSetup}
 */
export function docksidePeople(kit) {
  const { r, pick, make, avatar, randomLook } = kit;
  /** @type {import('../people.js').Person[]} */
  const civilians = [];
  const worker = (female) => {
    const id = female ? pick(WORKERS_F) : pick(WORKERS);
    return make(avatar(id), randomLook(), female ? 1.6 + r() * 0.1 : 1.72 + r() * 0.14);
  };

  // Workers walking back and forth along the north strip and on the apron.
  const lanes = [
    { a: { x: 186, z: -152.4 }, b: { x: 318, z: -152.4 }, y: PIER_Y },
    { a: { x: 186, z: -162.6 }, b: { x: 226, z: -162.6 }, y: PIER_Y },
    { a: { x: 246, z: -162.4 }, b: { x: 296, z: -162.4 }, y: PIER_Y },
    { a: { x: 304, z: -151.5 }, b: { x: 326, z: -190 }, y: PIER_Y },
    { a: { x: 312, z: -170 }, b: { x: 328, z: -240 }, y: PIER_Y },
    // Promenade along the quay, west of the pier.
    { a: { x: 153, z: -112 }, b: { x: 153, z: -236 }, y: PROMENADE_Y },
    { a: { x: 157, z: -120 }, b: { x: 157, z: -250 }, y: PROMENADE_Y }
  ];
  for (let i = 0; i < 13; i++) {
    const lane = lanes[i % lanes.length];
    const p = worker(r() < 0.18);
    const t = r();
    p.place(lane.a.x + (lane.b.x - lane.a.x) * t, lane.a.z + (lane.b.z - lane.a.z) * t, 0, lane.y);
    p.idleRole = r() < 0.5 ? 'idle' : 'idle2';
    p.walk([lane.a, lane.b], { loop: true, speed: 1.0 + r() * 0.5, start: r() < 0.5 ? 0 : 1, dir: 1 });
    civilians.push(p);
  }
  // Pairs on a break, one talking.
  for (const [x, z] of [[205, -161.6], [289, -153.2], [262, -161.8]]) {
    const a = worker(false);
    const b = worker(r() < 0.3);
    a.place(x - 0.6, z, Math.PI / 2, PIER_Y);
    b.place(x + 0.6, z, -Math.PI / 2, PIER_Y);
    a.standStill(Math.PI / 2, 'talk');
    b.standStill(-Math.PI / 2, r() < 0.5 ? 'idle' : 'idle2');
    civilians.push(a, b);
  }
  // A checker on the phone by the forklifts.
  const checker = worker(false);
  checker.place(306, -157.5, -2.2, PIER_Y);
  checker.standStill(-2.2, 'phone');
  civilians.push(checker);

  // The foreman waits at the container doors on the phone until Breg arrives.
  const foreman = make(avatar(FOREMAN), randomLook(), 1.8);
  const foremanSpot = { x: 227.4, z: -155.2 };
  foreman.place(foremanSpot.x, foremanSpot.z, -2.6, PIER_Y);
  foreman.standStill(-2.6, 'phone');
  civilians.push(foreman);

  // Breg: royal-blue and white track jacket, faded jeans.
  const targetLook = { suit: '#1f4fa8', trousers: '#4a5a72', skin: '#e0b49a', hair: '#2b2018', avatar: BREG };
  const target = make(avatar(BREG), targetLook, 1.84);
  const meeting = { x: 226.2, z: -156.9 };
  const route = [
    { x: 206.2, z: -153.4 },
    { x: meeting.x, z: meeting.z, wait: 24, anim: 'talk' },
    { x: 231.5, z: -153.0 },
    { x: 262, z: -153.0 },
    { x: 296, z: -154.2 },
    { x: 317.5, z: -162.5 },
    { x: GANGWAY.x0, z: GANGWAY.z },
    { x: GANGWAY.x1, z: GANGWAY.z },
    { x: GANGWAY.x1 + 2.6, z: GANGWAY.z }
  ];
  target.place(204.4, -153.6, Math.PI / 2, PIER_Y);
  target.walk(route, { loop: false, speed: 1.45 });
  const deck = route[route.length - 1];

  // Two bodyguards walk the same route on Breg's far side from the roof (north and north-east of
  // him), so they never stand in the line of fire between the shooter and their boss.
  const offsets = [{ x: -0.8, z: -1.5 }, { x: 0.9, z: -1.4 }];
  const guards = GUARDS.map((id, i) => {
    const g = make(avatar(id), { suit: '#202326', trousers: '#1b1d20', skin: i ? '#a46e4f' : '#c68e6e', hair: '#1a1410' }, 1.86 + i * 0.03);
    const o = offsets[i];
    g.place(204.4 + o.x, -153.6 + o.z, Math.PI / 2, PIER_Y);
    g.walk(route.map((p, k) => ({ x: p.x + (k >= 6 ? -1.2 - i * 1.2 : o.x), z: p.z + (k >= 5 ? 0 : o.z), wait: p.wait, anim: p.wait ? 'idle' : undefined })), { loop: false, speed: 1.45 });
    civilians.push(g);
    return g;
  });

  const exits = [
    { x: 166, z: -152 }, { x: 153, z: -105 }, { x: 153, z: -300 },
    { x: 318, z: -320 }, { x: 300, z: -330 }
  ];

  /** Keeps people standing on the gangway's slope and on deck. */
  const stickToGangway = (p) => {
    if (!p.alive || p.mode === 'gone') return;
    const y = gangwayY(p.x, p.z);
    if (y !== null) {
      p.root.position.y = y;
      p.groundY = y;
    }
  };

  return {
    civilians,
    target,
    targetLook,
    contact: foreman,
    exits,
    panicTarget(t) {
      // Breg runs for the ship; his guards cover him the whole way.
      const run = [{ x: Math.max(t.x, 300), z: -154.5 }, { x: 317.5, z: -162.5 }, { x: GANGWAY.x0, z: GANGWAY.z }, { x: GANGWAY.x1, z: GANGWAY.z }, deck];
      t.path = t.x > 300 ? run.slice(1) : run;
      t.index = 0;
      t.loop = false;
      t.wait = 0;
      t.speed = 4.2;
      t.mode = 'walk';
      t.panicDelay = 0.3;
      guards.forEach((g, i) => {
        if (!g.alive) return;
        g.path = t.path.map((p) => ({ x: p.x - 1.0 - i * 1.2, z: p.z - 1.1 }));
        g.index = 0;
        g.loop = false;
        g.wait = 0;
        g.speed = 4.0;
        g.mode = 'walk';
        g.panicDelay = 0.5;
        g.onArrive = () => {
          g.mode = 'gone';
          g.root.visible = false;
        };
      });
    },
    update() {
      // The foreman hangs up and talks while Breg stands with him.
      if (foreman.alive && foreman.mode === 'idle') {
        const talking = target.alive && target.wait > 0 && Math.hypot(target.x - meeting.x, target.z - meeting.z) < 0.6;
        foreman.setIdle(talking ? 'talk' : target.index > 1 ? 'idle' : 'phone');
      }
      stickToGangway(target);
      for (const g of guards) stickToGangway(g);
    },
    escaped() {
      return target.mode === 'idle' && target.index === target.path.length - 1 &&
        Math.hypot(target.x - deck.x, target.z - deck.z) < 0.6;
    }
  };
}

/**
 * Set dressing: the open container with cash cases, Breg's van, the ship's gangway, quay lamps,
 * forklifts and pallets. Repeated parts are merged by material, so it costs a dozen draw calls.
 * Async because it waits for the optional Sketchfab forklift model.
 * @param {THREE.Scene} scene
 */
export async function docksideDress(scene) {
  // The Sketchfab forklift (test-only, see sketchfab.json) replaces the box forklift when present.
  /** @type {THREE.Object3D | null} */
  const forkliftModel = await loadGLTF('./game-assets/sketchfab/forklift.glb').then((g) => {
    g.scene.traverse((o) => {
      const m = /** @type {any} */ (o);
      if (m.isMesh) m.castShadow = m.receiveShadow = true;
    });
    return g.scene;
  }).catch(() => null);
  const group = new THREE.Group();
  group.name = 'dockside-dressing';
  /** @type {number[][]} */
  const colliders = [];
  /** @type {THREE.Object3D[]} */
  const rangeMeshes = [];

  const mats = {
    container: new THREE.MeshStandardMaterial({ color: '#2f5d8a', roughness: 0.65, metalness: 0.35 }),
    inside: new THREE.MeshStandardMaterial({ color: '#141a20', roughness: 0.9 }),
    cases: new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.4, metalness: 0.6 }),
    van: new THREE.MeshStandardMaterial({ color: '#15181c', roughness: 0.35, metalness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ color: '#0c1117', roughness: 0.08, metalness: 0.9 }),
    tyre: new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: '#7d8186', roughness: 0.5, metalness: 0.6 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#d9a41e', roughness: 0.6, metalness: 0.2 }),
    wood: new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: 0.95 }),
    lamp: new THREE.MeshBasicMaterial({ color: '#ffd9a0' }),
    pole: new THREE.MeshStandardMaterial({ color: '#3a3f45', roughness: 0.6, metalness: 0.5 })
  };

  /** @type {Map<THREE.Material, THREE.BufferGeometry[]>} */
  const parts = new Map();
  /**
   * Adds a box (centre x, y, z; size w, h, d; turned rotY about y, tilted rotZ about z).
   * @param {THREE.Material} mat
   */
  const box = (mat, x, y, z, w, h, d, rotY = 0, rotZ = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotZ) g.rotateZ(rotZ);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    if (!parts.has(mat)) parts.set(mat, []);
    parts.get(mat).push(g);
  };
  const cylinder = (mat, x, y, z, radius, len, axis) => {
    const g = new THREE.CylinderGeometry(radius, radius, len, 12);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    g.translate(x, y, z);
    if (!parts.has(mat)) parts.set(mat, []);
    parts.get(mat).push(g);
  };
  const solid = (x0, y0, z0, x1, y1, z1) => colliders.push([x0, y0, z0, x1, y1, z1]);

  // ---------- the open container ----------
  const bx = (BOX.x0 + BOX.x1) / 2;
  const bz = (BOX.z0 + BOX.z1) / 2;
  const bw = BOX.z1 - BOX.z0;
  const blen = BOX.x1 - BOX.x0;
  // Shell: roof, floor, two long walls and the closed east end; the west end is open.
  box(mats.container, bx, BOX.h - 0.06, bz, blen, 0.12, bw);
  box(mats.container, bx, 0.08, bz, blen, 0.16, bw);
  box(mats.container, bx, BOX.h / 2, BOX.z0 + 0.06, blen, BOX.h, 0.12);
  box(mats.container, bx, BOX.h / 2, BOX.z1 - 0.06, blen, BOX.h, 0.12);
  box(mats.container, BOX.x1 - 0.06, BOX.h / 2, bz, 0.12, BOX.h, bw);
  box(mats.inside, bx + 0.2, BOX.h / 2, bz, blen - 0.6, BOX.h - 0.3, bw - 0.3);
  // Doors swung open against the long walls.
  box(mats.container, BOX.x0 - 0.6, BOX.h / 2, BOX.z0 - 0.1, 1.2, BOX.h, 0.08);
  box(mats.container, BOX.x0 - 0.6, BOX.h / 2, BOX.z1 + 0.1, 1.2, BOX.h, 0.08);
  // Cash cases stacked inside the doorway.
  for (const [dx, dy, dz] of [[0.6, 0.35, -0.5], [0.6, 0.35, 0.4], [1.3, 0.35, 0], [0.9, 0.85, -0.1]]) {
    box(mats.cases, BOX.x0 + dx, dy, bz + dz, 0.55, 0.38, 0.75);
  }
  solid(BOX.x0, 0, BOX.z0, BOX.x1, BOX.h, BOX.z1);

  // ---------- Breg's van ----------
  box(mats.van, VAN.x - 0.4, 1.15, VAN.z, VAN.len - 0.8, 1.9, VAN.w);
  box(mats.van, VAN.x + VAN.len / 2 - 0.6, 0.95, VAN.z, 1.2, 1.5, VAN.w - 0.05);
  box(mats.glass, VAN.x + VAN.len / 2 - 0.25, 1.6, VAN.z, 0.6, 0.7, VAN.w - 0.2, 0, -0.35);
  for (const [dx, dz] of [[-1.7, -1], [-1.7, 1], [1.6, -1], [1.6, 1]]) {
    cylinder(mats.tyre, VAN.x + dx, 0.38, VAN.z + dz * (VAN.w / 2 - 0.05), 0.38, 0.26, 'z');
  }
  solid(VAN.x - VAN.len / 2, 0, VAN.z - VAN.w / 2, VAN.x + VAN.len / 2, VAN.h, VAN.z + VAN.w / 2);

  // ---------- gangway up to the ship ----------
  const run = GANGWAY.x1 - GANGWAY.x0;
  const len = Math.hypot(run, GANGWAY.top);
  const tilt = Math.atan2(GANGWAY.top, run);
  const gx = (GANGWAY.x0 + GANGWAY.x1) / 2;
  box(mats.steel, gx, GANGWAY.top / 2 - 0.1, GANGWAY.z, len, 0.16, 1.5, 0, tilt);
  for (const side of [-0.75, 0.75]) {
    box(mats.steel, gx, GANGWAY.top / 2 + 0.95, GANGWAY.z + side, len, 0.06, 0.06, 0, tilt);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      box(mats.steel, GANGWAY.x0 + run * t, GANGWAY.top * t + 0.5, GANGWAY.z + side, 0.05, 1.0, 0.05);
    }
  }
  // Landing platform on deck.
  box(mats.steel, GANGWAY.x1 + 2.2, GANGWAY.top - 0.05, GANGWAY.z, 4.6, 0.1, 2.6);

  // ---------- quay lamps along the north edge ----------
  for (let x = 178; x <= 318; x += 20) {
    box(mats.pole, x, 4, -150.9, 0.18, 8, 0.18);
    box(mats.pole, x, 8.05, -151.5, 0.14, 0.14, 1.3);
    box(mats.lamp, x, 7.92, -152.05, 0.5, 0.12, 0.3);
  }

  // ---------- forklifts and pallets ----------
  const forklift = (x, z, rotY) => {
    if (forkliftModel) {
      const obj = placeProp(group, forkliftModel, x, 0, z, rotY, 3.4);
      if (obj) obj.traverse((o) => {
        if (/** @type {any} */ (o).isMesh) rangeMeshes.push(o);
      });
      solid(x - 1.2, 0, z - 1.4, x + 1.2, 2.1, z + 1.4);
      return;
    }
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    let p = at(0, 0);
    box(mats.yellow, p[0], 0.9, p[1], 1.2, 1.2, 2.0, rotY);
    p = at(0, -0.4);
    box(mats.yellow, p[0], 2.0, p[1], 1.1, 0.08, 1.1, rotY);
    for (const lx of [-0.45, 0.45]) {
      p = at(lx, 0.15);
      box(mats.pole, p[0], 1.45, p[1], 0.08, 1.1, 0.08, rotY);
      p = at(lx, 1.1);
      box(mats.pole, p[0], 1.6, p[1], 0.1, 3.2, 0.1, rotY);
      p = at(lx, 1.65);
      box(mats.pole, p[0], 0.15, p[1], 0.12, 0.06, 1.1, rotY);
    }
    for (const [lx, lz] of [[-0.55, -0.6], [0.55, -0.6], [-0.55, 0.6], [0.55, 0.6]]) {
      p = at(lx, lz);
      cylinder(mats.tyre, p[0], 0.3, p[1], 0.3, 0.22, 'x');
    }
    solid(x - 1.2, 0, z - 1.4, x + 1.2, 2.1, z + 1.4);
  };
  forklift(276, -160.6, Math.PI / 2);
  forklift(310, -170.5, 0.4);
  const pallets = (x, z, n) => {
    for (let i = 0; i < n; i++) {
      box(mats.wood, x, 0.07 + i * 0.95, z, 1.2, 0.14, 1.0);
      box(mats.wood, x, 0.55 + i * 0.95, z, 1.1, 0.8, 0.9);
    }
    solid(x - 0.6, 0, z - 0.5, x + 0.6, n * 0.95, z + 0.5);
  };
  pallets(250, -161.8, 2);
  pallets(251.4, -161.8, 1);
  pallets(301.5, -164.2, 3);
  pallets(213, -161.5, 2);

  // Merge everything per material: one draw call each.
  for (const [mat, list] of parts) {
    const geo = mergeGeometries(list, false);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, mat);
    const glow = mat === mats.lamp;
    mesh.castShadow = !glow;
    mesh.receiveShadow = !glow;
    group.add(mesh);
    if (!glow) rangeMeshes.push(mesh);
    for (const g of list) g.dispose();
  }
  scene.add(group);
  return { group, colliders, rangeMeshes };
}
