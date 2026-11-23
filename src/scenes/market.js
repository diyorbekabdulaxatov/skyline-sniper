// @ts-check
// Contract 04, Market Day (Old Town, 10:15, morning). Tanners Row, an east-west street in the
// block west of the plaza district (x -282 to -150, z -74 to -56), is full of market stalls.
// Lucien Marek walks in from the west end under the shooter's roof, browses the bakery stall,
// meets a courier at the fruit stall and walks to a taxi at the east end of the street.
//
// The shooter stands on the roof that closes the west end (eye at -283, 19.7, -65) and looks
// east along the street, with the morning sun behind. Only what that roof can see is built:
// the two rows of facades, the stalls, the taxi and the roof itself.
//
// Line of fire: the stalls stand in two lanes along the facades (north z -73 to -69.8, south
// -60.2 to -57) and Marek's waits are in the open aisle between them, so from 19.7 m up nothing
// solid stands between the roof and his head or chest; only shoppers passing within a couple of
// metres in front of him can hide him for a moment.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGLTF } from '../assets.js';
import { bakeByMaterial, normalise, instanced, place } from '../instancing.js';
import { facadeMaterial, buildingGeometry } from '../facades.js';
import { loadPack, partSize, placePart, solidOf, instancePart } from '../sketchfab.js';

/** Street geometry. North and south are the facade lines; stalls stand inside them. */
export const MARKET = {
  walkY: 0.15,
  north: -74,
  south: -56,
  x0: -282,
  x1: -150,
  roof: { x0: -297, x1: -282, z0: -74, z1: -56, y: 18 },
  taxi: { x: -153, z: -62.5 }
};
const Y = MARKET.walkY;

/** Where Marek gets into the taxi: on the pavement by its rear door (the taxi faces east). */
const DOOR = { x: -154.2, z: -64.2 };
const START = { x: -272, z: -65.2 };

const TARGET_AVATAR = 'Male_Adult_10';
const COURIER_AVATAR = 'Male_Adult_05';
const BUSKER_AVATAR = 'Male_Adult_07';

/**
 * Stalls: row ('n' north, left from the roof; 's' south, right), centre x, what they sell,
 * whether a vendor stands behind the counter, and whether the Sketchfab stall replaces the
 * procedural one when it is loaded.
 * @type {{ side: 'n' | 's', x: number, kind: string, vendor: boolean, model?: boolean, canopy?: number }[]}
 */
const STALLS = [
  { side: 'n', x: -268, kind: 'veg', vendor: true },
  { side: 'n', x: -264.4, kind: 'flowers', vendor: false },
  { side: 'n', x: -251, kind: 'cheese', vendor: true },
  { side: 'n', x: -239, kind: 'veg', vendor: true },
  { side: 'n', x: -235.4, kind: 'cloth', vendor: false },
  { side: 'n', x: -223, kind: 'flowers', vendor: true },
  // The fruit stall where Marek meets the courier: the only blue-and-white one on the left.
  { side: 'n', x: -211, kind: 'fruit', vendor: true, model: true, canopy: 2 },
  { side: 'n', x: -199, kind: 'fish', vendor: true },
  { side: 'n', x: -187, kind: 'veg', vendor: false },
  { side: 'n', x: -183.4, kind: 'fruit', vendor: true },
  { side: 'n', x: -171, kind: 'cloth', vendor: false },
  { side: 'n', x: -162, kind: 'bread', vendor: true },
  { side: 's', x: -270, kind: 'fruit', vendor: true },
  { side: 's', x: -258, kind: 'cheese', vendor: false },
  // The bakery stall where Marek stops first.
  { side: 's', x: -254.4, kind: 'bread', vendor: true },
  { side: 's', x: -241, kind: 'veg', vendor: true },
  { side: 's', x: -229, kind: 'flowers', vendor: false, model: true, canopy: 2 },
  { side: 's', x: -225.4, kind: 'fruit', vendor: true },
  { side: 's', x: -214, kind: 'cloth', vendor: false },
  { side: 's', x: -202, kind: 'fruit', vendor: true, model: true, canopy: 2 },
  { side: 's', x: -190, kind: 'veg', vendor: false },
  { side: 's', x: -178, kind: 'fish', vendor: true },
  { side: 's', x: -174.4, kind: 'bread', vendor: false },
  { side: 's', x: -164, kind: 'fruit', vendor: true }
];
const BAKERY = STALLS[14];
const FRUIT = STALLS[6];

/** z of a point `u` metres out from a row's facade toward the aisle. */
function rowZ(side, u) {
  return side === 'n' ? MARKET.north + u : MARKET.south - u;
}

/** Marek's route. He waits at the bakery (index 1) and with the courier (index 4). */
const MEET = { x: FRUIT.x - 0.4, z: rowZ('n', 5.3) };
const COURIER_SPOT = { x: FRUIT.x + 1.6, z: rowZ('n', 5.5) };
/** @type {import('../people.js').Waypoint[]} */
const ROUTE = [
  { x: -262, z: -64.6 },
  { x: BAKERY.x, z: rowZ('s', 5.1), wait: 7, anim: 'idle' },
  { x: -246, z: -64.2 },
  { x: -226, z: -66.2 },
  { x: MEET.x, z: MEET.z, wait: 24, anim: 'talk' },
  { x: -200, z: -66.0 },
  { x: -176, z: -65.4 },
  { x: -160, z: -64.6 },
  { x: DOOR.x, z: DOOR.z }
];
const MEET_INDEX = 4;
/** Which way he faces while waiting at a route index (toward the stall, then the courier).
 * @type {Record<number, number>} */
const FACES = { 1: 0, 4: Math.atan2(COURIER_SPOT.x - MEET.x, COURIER_SPOT.z - MEET.z) };

/**
 * @param {import('../people.js').CrowdKit} kit
 * @returns {import('../people.js').CrowdSetup}
 */
export function marketPeople(kit) {
  const { r, pick, make, avatar, randomLook, MEN, WOMEN } = kit;
  // Nobody else wears Marek's red track jacket or the courier's beige vest.
  const men = MEN.filter((id) => id !== TARGET_AVATAR && id !== COURIER_AVATAR);
  const person = (female) => {
    const id = female && WOMEN.length ? pick(WOMEN) : pick(men);
    return make(avatar(id), randomLook(), female ? 1.6 + r() * 0.1 : 1.7 + r() * 0.16);
  };
  /** @type {import('../people.js').Person[]} */
  const civilians = [];

  // Vendors behind their counters, facing the aisle.
  for (const st of STALLS) {
    if (!st.vendor) continue;
    const p = person(r() < 0.35);
    const face = st.side === 'n' ? 0 : Math.PI;
    p.place(st.x + (r() - 0.5) * 0.8, rowZ(st.side, 1.7), face, Y);
    p.standStill(face, r() < 0.15 ? 'phone' : r() < 0.5 ? 'idle' : 'idle2');
    civilians.push(p);
  }

  // Shoppers standing at stall fronts, looking at the goods.
  for (const st of [STALLS[2], STALLS[15], STALLS[9], STALLS[21], STALLS[12]]) {
    const p = person(r() < 0.45);
    const face = st.side === 'n' ? Math.PI : 0;
    p.place(st.x + (r() - 0.5) * 1.2, rowZ(st.side, 5.0), face, Y);
    p.standStill(face, r() < 0.5 ? 'idle' : 'idle2');
    civilians.push(p);
  }

  // The street musician in the gap of the south row, with two listeners.
  const busker = make(avatar(BUSKER_AVATAR), randomLook(), 1.78);
  busker.place(-247.8, rowZ('s', 2.2), Math.PI, Y);
  busker.standStill(Math.PI, 'talk');
  civilians.push(busker);
  for (const [x, z] of [[-249.0, -61.7], [-246.4, -62.0]]) {
    const p = person(r() < 0.5);
    p.place(x, z, 0, Y);
    p.standStill(Math.atan2(-247.8 - x, rowZ('s', 2.2) - z), 'idle');
    civilians.push(p);
  }

  // Pairs talking in the aisle, clear of Marek's path.
  for (const [x, z] of [[-232, -62.4], [-180, -62.6]]) {
    const a = person(r() < 0.3);
    const b = person(r() < 0.5);
    a.place(x - 0.6, z, Math.PI / 2, Y);
    b.place(x + 0.6, z, -Math.PI / 2, Y);
    a.standStill(Math.PI / 2, 'talk');
    b.standStill(-Math.PI / 2, r() < 0.5 ? 'idle' : 'idle2');
    civilians.push(a, b);
  }
  // Two people stopped on their phones.
  for (const [x, z, face] of [[-244, -67.4, 2.2], [-193, -63.2, -0.8]]) {
    const p = person(false);
    p.place(x, z, face, Y);
    p.standStill(face, 'phone');
    civilians.push(p);
  }

  // Shoppers walking the aisle in both directions, stopping at a stall or two on the way.
  // Their stops skip the bakery and the fruit stall so they never park in front of Marek.
  const stops = STALLS.filter((st) => st !== BAKERY && st !== FRUIT && st !== STALLS[5]);
  const lanes = [-63.0, -65.0, -66.8];
  for (let i = 0; i < 12; i++) {
    const z = lanes[i % lanes.length];
    /** @type {import('../people.js').Waypoint[]} */
    const route = [{ x: -274, z }];
    const picks = [pick(stops), pick(stops)].sort((a, b) => a.x - b.x);
    for (const st of picks) {
      if (r() < 0.3) continue;
      route.push({ x: st.x + (r() - 0.5) * 1.4, z: rowZ(st.side, 5.0), wait: 3 + r() * 5, anim: r() < 0.5 ? 'idle' : 'idle2' });
    }
    route.push({ x: -163, z });
    if (i % 2) route.reverse();
    const p = person(r() < 0.35);
    const k = Math.floor(r() * route.length);
    p.place(route[k].x + (r() - 0.5) * 2, route[k].z, 0, Y);
    p.walk(route, { loop: true, speed: 1.0 + r() * 0.35, start: k });
    civilians.push(p);
  }

  // The courier waits on his phone at the fruit stall, facing up the street.
  const courier = make(avatar(COURIER_AVATAR), { suit: '#b9a27a', trousers: '#3f4a34', skin: '#c68e6e', hair: '#2b2018' }, 1.77);
  courier.place(COURIER_SPOT.x, COURIER_SPOT.z, -Math.PI / 2, Y);
  courier.standStill(-Math.PI / 2, 'phone');
  civilians.push(courier);
  let courierLeft = false;

  // Lucien Marek: red track jacket with white stripes, black track trousers (Male_Adult_10).
  const targetLook = { suit: '#b3262a', trousers: '#16181b', skin: '#d9a77f', hair: '#1f1712', avatar: TARGET_AVATAR };
  const target = make(avatar(TARGET_AVATAR), targetLook, 1.8);
  target.place(START.x, START.z, Math.PI / 2, Y);
  target.walk(ROUTE, { loop: false, speed: 1.25 });

  const exits = [
    { x: -280, z: -65 }, { x: -147, z: -68.5 }, { x: -147, z: -60.5 }, { x: -153, z: -78 }
  ];

  return {
    civilians,
    target,
    targetLook,
    contact: courier,
    exits,
    panicTarget(t) {
      // He runs for the taxi.
      t.path = t.x < -162 ? [{ x: -162, z: -64.8 }, DOOR] : [DOOR];
      t.index = 0;
      t.loop = false;
      t.wait = 0;
      t.speed = 4.2;
      t.mode = 'walk';
      t.panicDelay = 0.3;
    },
    update(dt) {
      // While he waits, turn him to the stall or to the courier.
      if (target.alive && target.wait > 0 && target.path === ROUTE) {
        const face = FACES[target.index - 1];
        if (face !== undefined) {
          let diff = face - target.root.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          target.root.rotation.y += diff * Math.min(1, dt * 4);
        }
      }
      // The courier talks while Marek is with him, then walks off west and out of the street.
      if (courier.alive && !courierLeft && courier.mode === 'idle') {
        const near = Math.hypot(target.x - MEET.x, target.z - MEET.z);
        const meeting = target.alive && target.wait > 0 && near < 0.6;
        if (meeting) {
          courier.setIdle('talk');
        } else if (target.alive && target.path === ROUTE && target.index > MEET_INDEX && near > 3) {
          courierLeft = true;
          courier.walk([{ x: -224, z: -66.4 }, { x: -279, z: -65.6 }], { loop: false, speed: 1.3 });
          courier.onArrive = () => {
            courier.mode = 'gone';
            courier.root.visible = false;
          };
        } else {
          courier.setIdle(target.index > MEET_INDEX ? 'idle' : 'phone');
        }
      }
    },
    escaped() {
      return target.mode === 'idle' && target.index === target.path.length - 1 &&
        Math.hypot(target.x - DOOR.x, target.z - DOOR.z) < 0.6;
    }
  };
}

// ---------- set dressing ----------

/**
 * Facades along the street from the downtown_towers pack, in order from the west end. Each is
 * turned (rot) and scaled (s) so its long side lines the street and it is at most 30 m deep;
 * `size` is the fallback box when the pack is missing.
 */
const NORTH_ROW = [
  { name: 'Downtown_BrownstoneOffice_1', rot: 0, s: 1, size: [53, 24.7, 19.4], style: 'stone' },
  { name: 'Downtown_Residential_3', rot: 0, s: 0.8, size: [29.5, 22.3, 29.5], style: 'brick' },
  { name: 'Downtown_Mall_1', rot: 0, s: 0.94, size: [29.8, 16.6, 29.7], style: 'office' },
  { name: 'Downtown_ModernOffice_3', rot: 0, s: 1, size: [13.3, 18.4, 23], style: 'concrete' }
];
const SOUTH_ROW = [
  { name: 'Downtown_BrownstoneOffice_2', rot: Math.PI / 2, s: 1, size: [39.8, 26.2, 14.7], style: 'brick' },
  { name: 'Downtown_Residential_4', rot: 0, s: 0.78, size: [28.8, 21.8, 28.8], style: 'stone' },
  { name: 'Downtown_PublicBuilding_1', rot: 0, s: 0.82, size: [28.9, 21.2, 28.9], style: 'office' },
  { name: 'Downtown_Brutal_1', rot: 0, s: 0.74, size: [29, 16.2, 28.6], style: 'concrete' }
];
const MAX_DEPTH = 29.5;

/** Goods colours per kind of stall (vertex colours, one draw call for all of them).
 * @type {Record<string, string[]>} */
const GOODS = {
  fruit: ['#c9302c', '#f0a02a', '#e8d23a', '#7fb03a'],
  veg: ['#3f7d2c', '#c0392b', '#e07b24', '#6a8f3a'],
  flowers: ['#d94f8a', '#f2e14c', '#e86a3a', '#f4f1ea'],
  bread: ['#b07a3c', '#d8a35c', '#8a5a2b'],
  cheese: ['#f0d27a', '#e8b84a', '#fff1c2'],
  fish: ['#c7d3da', '#9fb2bd', '#e6eef2'],
  cloth: ['#3b5c8a', '#8a3b5c', '#d8c9a8', '#2f6b5a']
};
/** Canopy stripes: red, green, blue and orange with white. */
const CANOPIES = [['#b8322c', '#f3eee4'], ['#2f6b3e', '#f3eee4'], ['#2c5d9a', '#f3eee4'], ['#d77a26', '#f6e7c8']];

/** Skyline boxes (city.js) that would stand in or over the street, hidden while it is dressed. */
const SKYLINE_CLEAR = { x0: -330, x1: -120, z0: -130, z1: -10 };
/** @type {{ mesh: THREE.InstancedMesh, i: number, m: THREE.Matrix4 }[] | null} */
let hiddenSkyline = null;
/** @type {THREE.Group | null} */
let dressed = null;
/** @type {THREE.Object3D | null} */
let taxi = null;
let taxiDriven = 0;

/**
 * The market street: facades, the shooter's roof, stalls with goods, bunting, street lamps and
 * the taxi. Async because it waits for the optional Sketchfab packs and the car model.
 * @param {THREE.Scene} scene
 */
export async function marketDress(scene) {
  const [downtown, props2, crates, stallGltf, carGltf] = await Promise.all([
    loadPack('downtown_towers'),
    loadPack('city_props_2'),
    loadPack('fruit_crates'),
    loadGLTF('./game-assets/sketchfab/market_stall.glb').catch(() => null),
    loadGLTF('./models/props/sedan_wagon.glb').catch(() => null)
  ]);
  const group = new THREE.Group();
  group.name = 'market-dressing';
  dressed = group;
  if (scene) hideSkyline(scene);
  /** @type {number[][]} */
  const colliders = [];
  /** @type {THREE.Object3D[]} */
  const rangeMeshes = [];
  const solid = (x0, y0, z0, x1, y1, z1) => colliders.push([x0, y0, z0, x1, y1, z1]);

  // ---------- facades ----------
  const roofMat = new THREE.MeshStandardMaterial({ color: '#8e8c87', roughness: 0.95 });
  /**
   * @param {typeof NORTH_ROW} defs @param {number} front facade line @param {number} away -1 when
   *   the buildings extend north of the line, +1 south
   */
  const row = (defs, front, away) => {
    let cursor = MARKET.x0;
    for (const def of defs) {
      const part = downtown && downtown.parts.get(def.name);
      if (part) {
        const size = partSize(part);
        const turned = Math.abs(Math.sin(def.rot)) > 0.5;
        let s = def.s;
        const depth = (turned ? size.x : size.z);
        if (depth * s > MAX_DEPTH) s = MAX_DEPTH / depth;
        const w = (turned ? size.z : size.x) * s;
        const d = depth * s;
        const obj = placePart(group, part, { x: cursor + w / 2, z: front + away * d / 2, y: Y, rot: def.rot, s });
        const sol = solidOf(obj);
        colliders.push(sol.box);
        rangeMeshes.push(...sol.meshes);
        cursor += w;
      } else {
        const [w, h, d] = def.size;
        const facade = facadeMaterial(def.style);
        const mesh = new THREE.Mesh(buildingGeometry(w, h, d), [facade, facade, roofMat, roofMat, facade, facade]);
        mesh.position.set(cursor + w / 2, h / 2, front + away * d / 2);
        mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
        rangeMeshes.push(mesh);
        const zA = front;
        const zB = front + away * d;
        solid(cursor, 0, Math.min(zA, zB), cursor + w, h, Math.max(zA, zB));
        cursor += w;
      }
      if (cursor > MARKET.x1 - 4) break;
    }
  };
  row(NORTH_ROW, MARKET.north, -1);
  row(SOUTH_ROW, MARKET.south, 1);

  // ---------- the shooter's roof, closing the west end of the street ----------
  const rf = MARKET.roof;
  const roofW = rf.x1 - rf.x0;
  const roofD = rf.z1 - rf.z0;
  const block = new THREE.Mesh(buildingGeometry(roofW, rf.y, roofD), [facadeMaterial('stone'), facadeMaterial('stone'), roofMat, roofMat, facadeMaterial('stone'), facadeMaterial('stone')]);
  block.position.set((rf.x0 + rf.x1) / 2, rf.y / 2, (rf.z0 + rf.z1) / 2);
  block.receiveShadow = true;
  group.add(block);
  rangeMeshes.push(block);
  solid(rf.x0, 0, rf.z0, rf.x1, rf.y, rf.z1);
  const parapetMat = new THREE.MeshStandardMaterial({ color: '#7e7a74', roughness: 0.95 });
  /** @type {THREE.BufferGeometry[]} */
  const parapets = [];
  const parapet = (x0, z0, x1, z1) => {
    const g = new THREE.BoxGeometry(x1 - x0, 0.84, z1 - z0);
    g.translate((x0 + x1) / 2, rf.y + 0.42, (z0 + z1) / 2);
    parapets.push(g);
    solid(x0, rf.y, z0, x1, rf.y + 0.84, z1);
  };
  parapet(rf.x1 - 0.4, rf.z0, rf.x1, rf.z1);
  parapet(rf.x0, rf.z0, rf.x1, rf.z0 + 0.4);
  parapet(rf.x0, rf.z1 - 0.4, rf.x1, rf.z1);
  const parapetMesh = new THREE.Mesh(mergeGeometries(parapets, false), parapetMat);
  parapetMesh.castShadow = parapetMesh.receiveShadow = true;
  group.add(parapetMesh);
  rangeMeshes.push(parapetMesh);

  // ---------- stalls ----------
  const stallModel = stallGltf ? bakeStall(stallGltf.scene) : null;
  /** @type {Map<THREE.Material, THREE.BufferGeometry[]>} */
  const parts = new Map();
  const add = (mat, g) => {
    if (!parts.has(mat)) parts.set(mat, []);
    parts.get(mat).push(g);
  };
  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 0.85 }),
    crate: new THREE.MeshStandardMaterial({ color: '#a7804f', roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.5, metalness: 0.6 }),
    goods: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
    canopies: CANOPIES.map(([a, b]) => new THREE.MeshStandardMaterial({ map: stripeTexture(a, b), roughness: 0.9, side: THREE.DoubleSide }))
  };
  const color = new THREE.Color();
  /** A box at centre (x, y, z), size (w, h, d), optionally tilted about x. */
  const box = (mat, x, y, z, w, h, d, tiltX = 0, tint = null) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (tiltX) g.rotateX(tiltX);
    g.translate(x, y, z);
    if (tint) {
      color.set(tint);
      const n = g.attributes.position.count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        c[i * 3] = color.r;
        c[i * 3 + 1] = color.g;
        c[i * 3 + 2] = color.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    add(mat, g);
  };
  /** @type {{ x: number, z: number, y: number, rot: number }[]} */
  const modelSpots = [];
  /** @type {{ x: number, z: number }[]} */
  const crateSpots = [];
  STALLS.forEach((st, i) => {
    const f = st.side === 'n' ? 1 : -1;
    const z = (u) => rowZ(st.side, u);
    const counterZ = z(3.1);
    // Solids: the counter and the canopy (both inside the stall lane, out of the aisle).
    solid(st.x - 1.5, 0, Math.min(z(2.6), z(3.6)), st.x + 1.5, Y + 0.95, Math.max(z(2.6), z(3.6)));
    solid(st.x - 1.65, Y + 2.2, Math.min(z(1.0), z(4.2)), st.x + 1.65, Y + 2.85, Math.max(z(1.0), z(4.2)));
    if (st.model && stallModel) {
      modelSpots.push({ x: st.x, z: z(1.0), y: Y, rot: st.side === 'n' ? 0 : Math.PI });
      return;
    }
    // Counter, posts and a sloping striped canopy with a front flap.
    box(mats.wood, st.x, Y + 0.45, counterZ, 3.0, 0.9, 1.0);
    for (const dx of [-1.55, 1.55]) {
      box(mats.metal, st.x + dx, Y + 1.4, z(1.1), 0.06, 2.8, 0.06);
      box(mats.metal, st.x + dx, Y + 1.15, z(4.1), 0.06, 2.3, 0.06);
    }
    const canopy = mats.canopies[st.canopy !== undefined ? st.canopy : [0, 1, 3][i % 3]];
    const run = 3.2;
    const drop = 0.45;
    box(canopy, st.x, Y + 2.52, z(2.6), 3.3, 0.03, Math.hypot(run, drop), f * Math.atan2(drop, run));
    box(canopy, st.x, Y + 2.18, z(4.22), 3.3, 0.26, 0.02);
    // Goods on the counter, crates stacked beside the vendor.
    const colours = GOODS[st.kind] || GOODS.fruit;
    const fresh = st.kind === 'fruit' || st.kind === 'veg';
    if (fresh && crates) {
      for (const dx of [-0.95, 0, 0.95]) crateSpots.push({ x: st.x + dx, z: counterZ });
    } else {
      [-0.95, 0, 0.95].forEach((dx, k) => {
        box(mats.goods, st.x + dx, Y + 1.0, counterZ, 0.85, 0.2, 0.8, 0, colours[(k + i) % colours.length]);
      });
    }
    box(mats.crate, st.x + 1.2, Y + 0.25, z(1.4), 0.6, 0.5, 0.45);
    if (i % 2) box(mats.crate, st.x + 1.2, Y + 0.75, z(1.4), 0.6, 0.5, 0.45);
  });

  // The busker's open instrument case and a small amplifier.
  box(mats.goods, -247.0, Y + 0.06, rowZ('s', 3.0), 1.0, 0.12, 0.4, 0, '#2a1d16');
  box(mats.goods, -247.0, Y + 0.13, rowZ('s', 3.0), 0.9, 0.02, 0.32, 0, '#7a1f2a');
  box(mats.goods, -248.9, Y + 0.25, rowZ('s', 1.8), 0.45, 0.5, 0.3, 0, '#1b1b1b');

  // Bunting across the street: small flags on three lines between the facades.
  const flagColours = ['#c0392b', '#f1c40f', '#2e86c1', '#27ae60', '#f4f1ea'];
  /** @type {number[]} */
  const wire = [];
  /** @type {THREE.BufferGeometry[]} */
  const flags = [];
  for (const x of [-262, -237, -188]) {
    const n = 22;
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const zz = MARKET.north + (MARKET.south - MARKET.north) * t;
      const yy = 7.2 - 1.1 * 4 * t * (1 - t);
      const p = new THREE.Vector3(x, yy, zz);
      if (prev) wire.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      if (k > 0 && k < n) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([x, yy, zz - 0.2, x, yy, zz + 0.2, x, yy - 0.38, zz], 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0], 3));
        color.set(flagColours[k % flagColours.length]);
        g.setAttribute('color', new THREE.Float32BufferAttribute([color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b], 3));
        flags.push(g);
      }
      prev = p;
    }
  }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  group.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: '#303030' })));
  const flagMesh = new THREE.Mesh(mergeGeometries(flags, false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  group.add(flagMesh);

  // Merge each material's boxes: one draw call per material.
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

  // Sketchfab stalls (one instanced set) and fruit crates on the fresh-produce counters.
  if (stallModel && modelSpots.length) {
    const set = instanced(stallModel.baked, modelSpots.length);
    modelSpots.forEach((p, i) => set.set(i, place(p.x, p.y, p.z, p.rot, 1)));
    set.finish();
    group.add(set.group);
    rangeMeshes.push(...set.meshes);
  }
  if (crates && crateSpots.length) placeCrates(group, crates, crateSpots);

  // Old Town street lamps along both facades, between the stalls and the walls.
  const lamp = props2 && props2.parts.get('lamp0');
  if (lamp) {
    /** @type {{ x: number, z: number, y: number, rot: number }[]} */
    const lamps = [];
    for (const x of [-276, -246, -217, -192, -166]) {
      lamps.push({ x, z: rowZ('n', 0.5), y: Y, rot: 0 });
      lamps.push({ x: x + 12, z: rowZ('s', 0.5), y: Y, rot: Math.PI });
    }
    instancePart(group, lamp, lamps);
  }

  // ---------- the taxi at the east end ----------
  taxi = buildTaxi(carGltf);
  taxi.position.set(MARKET.taxi.x, Y, MARKET.taxi.z);
  taxi.rotation.y = Math.PI / 2;
  taxiDriven = 0;
  group.add(taxi);
  taxi.traverse((o) => {
    if (/** @type {any} */ (o).isMesh) rangeMeshes.push(o);
  });
  solid(MARKET.taxi.x - 2.2, 0, MARKET.taxi.z - 0.95, MARKET.taxi.x + 2.2, Y + 1.5, MARKET.taxi.z + 0.95);

  scene.add(group);
  return { group, colliders, rangeMeshes };
}

/**
 * The Sketchfab market stall (kiselevmiki, CC-BY) baked into one geometry per material, without
 * its cobbled "floor" patch and the empty "Light 1" node, scaled to fit a 3.4 x 3 m footprint
 * and turned so its front (crates and price tags, at -z in the file) faces +z, with the back
 * edge at z = 0: an instance at the stall lane's back line (u = 1) of the north row faces the
 * aisle. The file is in centimetres (about 212 x 157 x 165 without the floor).
 * @param {THREE.Object3D} root
 */
function bakeStall(root) {
  try {
    root.updateMatrixWorld(true);
    const skip = /^(floor|light 1)$/i;
    const baked = bakeByMaterial(root, (mesh) => {
      for (let o = /** @type {THREE.Object3D | null} */ (mesh); o; o = o.parent) {
        if (skip.test(o.name)) return false;
      }
      return true;
    });
    if (!baked.size) return null;
    const size = normalise(baked, { length: 3.4 });
    // Long side along x; then fit the depth into 3 m and put the back edge on z = 0.
    const sideways = size.depth > size.width;
    const d = sideways ? size.width : size.depth;
    const w = sideways ? size.depth : size.width;
    const k = Math.min(1, 3.0 / d, 3.4 / w);
    const turn = (sideways ? Math.PI / 2 : 0) + Math.PI;
    const m = new THREE.Matrix4().makeTranslation(0, 0, (d * k) / 2).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeRotationY(turn));
    for (const g of baked.values()) {
      g.applyMatrix4(m);
      g.computeBoundingBox();
      g.computeBoundingSphere();
    }
    return { baked };
  } catch (err) {
    console.warn('Market stall model could not be used.', err);
    return null;
  }
}

/** Crates of fruit from the fruit-seller pack (arnedecoster, CC-BY; about 40 x 30 cm in the file). */
const CRATE_PARTS = ['AppleCrate', 'LemonCrate', 'WatermelonCrate', 'MangusteenCrate', 'RambutanCrate', 'DurianCrate'];

/**
 * Puts the fruit-seller pack's crates on the fresh-produce counters, one instanced set per kind
 * of crate, each scaled to a 0.8 m long crate.
 * @param {THREE.Group} group
 * @param {import('../sketchfab.js').Pack} pack
 * @param {{ x: number, z: number }[]} spots
 */
function placeCrates(group, pack, spots) {
  /** @type {{ part: THREE.Object3D, s: number }[]} */
  const kinds = [];
  for (const name of CRATE_PARTS) {
    const part = pack.parts.get(name);
    if (!part) continue;
    const size = partSize(part);
    const foot = Math.max(size.x, size.z);
    if (foot > 0) kinds.push({ part, s: 0.8 / foot });
  }
  if (!kinds.length) return;
  /** @type {Map<number, { x: number, z: number, y: number, rot: number, s: number }[]>} */
  const byKind = new Map();
  spots.forEach((p, i) => {
    const k = (i * 7 + Math.floor(i / 3)) % kinds.length;
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push({ x: p.x, z: p.z, y: Y + 0.9, rot: (i % 2) * Math.PI, s: kinds[k].s });
  });
  for (const [k, list] of byKind) instancePart(group, kinds[k].part, list);
}

/**
 * A yellow taxi from the CC-BY sedan (models/props/sedan_wagon.glb), or a box car when the model
 * is missing, with a lit TAXI sign on the roof. Faces +z.
 * @param {any} gltf
 */
function buildTaxi(gltf) {
  const g = new THREE.Group();
  g.name = 'taxi';
  const yellow = new THREE.MeshPhysicalMaterial({ color: '#f2b705', roughness: 0.3, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshStandardMaterial({ color: '#10161c', roughness: 0.05, metalness: 0.85 });
  let height = 1.45;
  let made = false;
  if (gltf) {
    try {
      const baked = bakeByMaterial(gltf.scene, (mesh) => {
        let o = /** @type {THREE.Object3D | null} */ (mesh);
        while (o) {
          if (o.name === 'body_sedan') return true;
          o = o.parent;
        }
        return false;
      });
      if (baked.size) {
        height = normalise(baked, { length: 4.4 }).height;
        for (const [mat, geo] of baked) {
          const name = (mat.name || '').toLowerCase();
          let m;
          if (/^body(\.\d+)?$/.test(name)) m = yellow;
          else if (name.includes('window')) m = glass;
          else {
            m = /** @type {THREE.MeshStandardMaterial} */ (mat.clone());
            m.metalness = name.includes('rim') ? 0.6 : 0.05;
            m.roughness = name.includes('tire') ? 0.9 : 0.5;
          }
          const mesh = new THREE.Mesh(geo, m);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          g.add(mesh);
        }
        made = true;
      }
    } catch (err) {
      console.warn('Taxi model could not be used.', err);
    }
  }
  if (!made) {
    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.62, 4.5), yellow);
    lower.position.y = 0.62;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.56, 2.4), glass);
    cabin.position.set(0, 1.2, -0.2);
    for (const m of [lower, cabin]) {
      m.castShadow = true;
      g.add(m);
    }
    height = 1.48;
  }
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.24, 0.3), new THREE.MeshStandardMaterial({
    map: signTexture(), emissive: '#ffffff', emissiveIntensity: 0.5, roughness: 0.6
  }));
  /** @type {THREE.MeshStandardMaterial} */ (sign.material).emissiveMap = /** @type {THREE.MeshStandardMaterial} */ (sign.material).map;
  sign.position.set(0, height + 0.1, -0.35);
  g.add(sign);
  return g;
}

/** After Marek gets in, the taxi pulls out east and turns north up the cross street. */
export function marketOnEscape(dt, t) {
  if (!taxi) return;
  taxiDriven += dt * Math.min(11, 1 + t * 5);
  const turnX = -144;
  const along = turnX - MARKET.taxi.x;
  if (taxiDriven < along) {
    taxi.position.x = MARKET.taxi.x + taxiDriven;
    taxi.rotation.y = Math.PI / 2;
  } else {
    taxi.position.x = turnX;
    taxi.position.z = MARKET.taxi.z - (taxiDriven - along);
    taxi.rotation.y = Math.PI;
  }
}

/** Parks the taxi again for a new attempt. */
export function marketReset() {
  if (!taxi) return;
  taxi.position.set(MARKET.taxi.x, Y, MARKET.taxi.z);
  taxi.rotation.y = Math.PI / 2;
  taxiDriven = 0;
}

/** Hides the city's distant skyline boxes that would stand in or over the market street. */
function hideSkyline(scene) {
  if (hiddenSkyline) return;
  hiddenSkyline = [];
  const b = SKYLINE_CLEAR;
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const o of scene.children) {
    const mesh = /** @type {any} */ (o);
    if (!mesh.isInstancedMesh) continue;
    const params = mesh.geometry && mesh.geometry.parameters;
    if (!params || params.width !== 1 || params.height !== 1 || params.depth !== 1) continue;
    let touched = false;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      if (s.x < 20 || s.y < 20) continue;
      const overlaps = p.x + s.x / 2 > b.x0 && p.x - s.x / 2 < b.x1 && p.z + s.z / 2 > b.z0 && p.z - s.z / 2 < b.z1;
      if (!overlaps) continue;
      hiddenSkyline.push({ mesh, i, m: m.clone() });
      mesh.setMatrixAt(i, zero);
      touched = true;
    }
    if (touched) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }
}

/** Puts the skyline back once the market's dressing has left the scene. */
export function marketUndress() {
  if (!hiddenSkyline || (dressed && dressed.parent)) return;
  const meshes = new Set();
  for (const h of hiddenSkyline) {
    h.mesh.setMatrixAt(h.i, h.m);
    meshes.add(h.mesh);
  }
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  hiddenSkyline = null;
  taxi = null;
}

/** Canvas stripes for a canopy: alternating colour bands across its width. */
function stripeTexture(a, b) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 8;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? b : a;
    g.fillRect(i * 16, 0, 16, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The roof sign: black TAXI on a warm white box. */
function signTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 40;
  const g = c.getContext('2d');
  g.fillStyle = '#fff4cf';
  g.fillRect(0, 0, 128, 40);
  g.fillStyle = '#1a1a1a';
  g.font = 'bold 30px "Arial Narrow", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('TAXI', 64, 21);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
