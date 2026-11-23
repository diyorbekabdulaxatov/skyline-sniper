// @ts-check
// Contract 06, Rooftop Pool (Cassian Hotel, 12:30, noon light). The network's money courier,
// Dario Castell, spends his lunch hour on the pool deck on the hotel's roof: a talk at his
// lounger, a long phone call at the south railing, a wade in the shallow end, a drink at the bar,
// then the lift house in the north-west corner. If he reaches its door, he is gone.
//
// The shooter is on the roof of a taller glass tower about 230 m to the south-east (layout and
// numbers in pool-layout.js). Only what that roof can see is built: the hotel and its deck, the
// blocks and streets between the towers, and a few neighbouring towers beside and behind the
// hotel. Nothing stands behind the shooter.
//
// Lines of fire: the target's chest and head at each shot window (lounger, railing, pool, bar)
// were checked in Node against every collider here and every standing guest (pool-layout.js has
// all of them). The line is at least 57 m above the ground everywhere between the two towers,
// so the blocks in between (20 to 44 m) never cut it.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGLTF } from '../assets.js';
import { facadeMaterial, buildingGeometry } from '../facades.js';
import { bakeByMaterial, normalise, instanced, place } from '../instancing.js';
import { loadPack, partSize, placePart, solidOf, instancePart } from '../sketchfab.js';
import {
  POOL, ROUTE, ROUTE_SPEED, GUESTS, WALKERS, BLOCKS, NEIGHBOURS, PLINTHS,
  groundAt, inPool, poolColliders
} from './pool-layout.js';

/** The target's avatar. Nobody else on the deck uses it; his copy gets a white linen shirt and sunglasses. */
const TARGET_AVATAR = 'Male_Adult_11';
const TARGET_KEY = 'Pool_Castell';
/** The lifeguard's red jacket. */
const LIFEGUARD_AVATAR = 'Male_Adult_10';
const SKETCHFAB = './game-assets/sketchfab/';

/** Skyline boxes (city.js) standing in this district are hidden while the contract is dressed. */
const SKYLINE_ZONE = { x0: -440, x1: -110, z0: -10, z1: 330 };
/** @type {{ mesh: THREE.InstancedMesh, i: number, m: THREE.Matrix4 }[] | null} */
let hidden = null;
/** @type {THREE.Group | null} */
let dressed = null;

// ---------------------------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------------------------

/**
 * @param {import('../people.js').CrowdKit} kit
 * @returns {import('../people.js').CrowdSetup}
 */
export function poolPeople(kit) {
  const { r, make, avatar, randomLook, MEN, WOMEN } = kit;
  const deck = POOL.deckY;
  // The courier's own copy of his avatar: white linen shirt, dark sunglasses.
  const original = kit.rocketbox && kit.rocketbox[TARGET_AVATAR];
  if (original && kit.rocketbox) kit.rocketbox[TARGET_KEY] = courierBase(original);

  const men = MEN.filter((id) => id !== TARGET_AVATAR && id !== LIFEGUARD_AVATAR);
  const women = WOMEN;
  const person = (female) => {
    const pool = female && women.length ? women : men;
    const id = pool[Math.floor(r() * pool.length)];
    return make(avatar(id), randomLook(), female ? 1.6 + r() * 0.1 : 1.72 + r() * 0.14);
  };
  const faceTo = (p, x, z) => Math.atan2(x - p.x, z - p.z);
  /** @type {import('../people.js').Person[]} */
  const civilians = [];
  /** @type {any} */
  let companion = null;
  /** @type {any} */
  let lifeguard = null;
  /** @type {import('../people.js').Person[]} */
  const bartenders = [];

  for (const g of GUESTS) {
    const p = g.kind === 'lifeguard' ? make(avatar(LIFEGUARD_AVATAR), randomLook(), 1.84) : person(!!g.female);
    const y = g.kind === 'lifeguard' ? deck + POOL.lifeguard.h : groundAt(g.x, g.z);
    p.place(g.x, g.z, g.face, y);
    p.standStill(g.face, g.role);
    civilians.push(p);
    if (g.kind === 'companion') companion = p;
    if (g.kind === 'lifeguard') lifeguard = p;
    if (g.kind === 'staff') bartenders.push(p);
  }
  // Two waiters loop between the bar and the loungers; a swimmer wades up and down the pool.
  WALKERS.forEach((route, i) => {
    const swimmer = i === 2;
    const p = person(false);
    const s = route[i % route.length];
    p.place(s.x, s.z, 0, groundAt(s.x, s.z));
    p.walk(route, { loop: true, speed: swimmer ? 0.55 : 1.05 + r() * 0.2, start: (i + 1) % route.length });
    civilians.push(p);
  });

  // Dario Castell: white linen shirt, light blue jeans, dark sunglasses (Male_Adult_11, recoloured).
  const targetLook = { suit: '#f1ede4', trousers: '#7f97b3', skin: '#d9a98a', hair: '#2a1f18', avatar: TARGET_KEY };
  const target = make(avatar(TARGET_KEY), targetLook, 1.82);
  const start = ROUTE[0];
  target.place(start.x, start.z, start.face, groundAt(start.x, start.z));
  target.walk(ROUTE, { loop: false, speed: ROUTE_SPEED });

  const door = POOL.door;
  const exits = [{ x: door.x, z: door.z }, { x: POOL.serviceDoor.x, z: POOL.serviceDoor.z }];
  const all = [...civilians, target];

  return {
    civilians,
    target,
    targetLook,
    contact: null,
    exits,
    panicTarget(t) {
      // He runs for the lift: out of the water by the steps, round the pool on the nearer side.
      /** @type {{ x: number, z: number }[]} */
      let path;
      if (t.z <= 71) path = [door];
      else if (inPool(t.x, t.z)) path = [{ x: -283.4, z: 76.5 }, { x: -283.2, z: 69.5 }, door];
      else if (t.x > -295) path = [{ x: -283.2, z: t.z }, { x: -283.2, z: 69.5 }, door];
      else path = [{ x: -309.6, z: t.z }, { x: -309.6, z: 70.4 }, { x: -305.3, z: 70.4 }, door];
      t.path = path.map((p) => ({ x: p.x, z: p.z }));
      t.index = 0;
      t.loop = false;
      t.wait = 0;
      t.speed = 3.6;
      t.mode = 'walk';
      t.panicDelay = 0.3;
    },
    update(dt) {
      // While he waits at a spot, turn him to whoever he talks to (or to the city on the phone).
      if (target.alive && target.wait > 0 && target.index > 0 && target.path === /** @type {any} */ (ROUTE)) {
        const wp = /** @type {any} */ (ROUTE[target.index - 1]);
        if (wp && wp.face !== undefined) {
          let diff = wp.face - target.root.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          target.root.rotation.y += diff * Math.min(1, dt * 4);
        }
      }
      const atStart = target.alive && target.index === 1 && target.wait > 0;
      if (companion && companion.alive && companion.mode === 'idle') {
        companion.setIdle(atStart ? 'talk' : 'idle2');
        const want = target.alive ? faceTo(companion, target.x, target.z) : companion.root.rotation.y;
        let diff = want - companion.root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        companion.root.rotation.y += diff * Math.min(1, dt * 1.5);
      }
      const atBar = target.alive && target.wait > 0 && Math.hypot(target.x - ROUTE[8].x, target.z - ROUTE[8].z) < 0.5;
      for (const b of bartenders) {
        if (b.alive && b.mode === 'idle') b.setIdle(atBar && b === bartenders[0] ? 'talk' : 'idle');
      }
      // Everyone walking follows the deck, down the pool steps and through the water.
      for (const p of all) {
        if (!p.alive || p.mode === 'gone' || (p === lifeguard && p.mode === 'idle')) continue;
        if (p.mode !== 'walk' && p.mode !== 'flee') continue;
        const y = groundAt(p.x, p.z);
        p.root.position.y = y;
        p.groundY = y;
      }
    },
    escaped() {
      return target.mode === 'idle' && target.index === target.path.length - 1 &&
        Math.hypot(target.x - door.x, target.z - door.z) < 0.5;
    }
  };
}

/** @type {WeakMap<object, any>} */
const courierCache = new WeakMap();

/**
 * A copy of the target's avatar with the shirt repainted white linen and sunglasses on the head
 * bone, so the briefing photo and the deck show the same man. Cached per loaded glTF.
 * @param {import('../people.js').Base} base
 * @returns {import('../people.js').Base}
 */
function courierBase(base) {
  if (!base || base.kind !== 'rocketbox') return base;
  const hit = courierCache.get(base.gltf);
  if (hit) return hit;
  const scene = SkeletonUtils.clone(base.gltf.scene);
  scene.traverse((o) => {
    const mesh = /** @type {any} */ (o);
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = list.map((m) => (m && /_body$/i.test(m.name || '') ? linenShirt(m) : m));
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
  try {
    addSunglasses(scene, base.baseHeight);
  } catch (err) {
    console.warn('Sunglasses were not added.', err);
  }
  /** @type {import('../people.js').Base} */
  const derived = { ...base, id: TARGET_KEY, gltf: { ...base.gltf, scene } };
  courierCache.set(base.gltf, derived);
  return derived;
}

/**
 * Repaints the dark shirt of the avatar's body texture as off-white linen, keeping its folds.
 * Shirt texels are dark and grey (low chroma); jeans are bluish, skin is warm and bright, and the
 * shoes sit in the bottom fifth of the texture. On any failure the original material is kept.
 * @param {THREE.Material} mat
 */
function linenShirt(mat) {
  const src = /** @type {any} */ (mat).map;
  const img = src && src.image;
  if (!img || !img.width) return mat;
  try {
    const w = img.width;
    const h = img.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, w, h);
    const d = data.data;
    for (let y = 0; y < h; y++) {
      if (y / h > 0.8) break;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const rr = d[i];
        const gg = d[i + 1];
        const bb = d[i + 2];
        if (bb > rr + 6) continue;
        const lum = 0.299 * rr + 0.587 * gg + 0.114 * bb;
        if (rr > bb + 40 && lum > 90) continue;
        if (Math.max(rr, gg, bb) - Math.min(rr, gg, bb) >= 40 || lum >= 125) continue;
        const k = Math.min(1.08, 0.62 + lum / 140);
        d[i] = Math.min(255, Math.round(236 * k));
        d[i + 1] = Math.min(255, Math.round(232 * k));
        d[i + 2] = Math.min(255, Math.round(220 * k));
      }
    }
    g.putImageData(data, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = src.flipY;
    tex.colorSpace = src.colorSpace;
    tex.wrapS = src.wrapS;
    tex.wrapT = src.wrapT;
    tex.channel = src.channel;
    tex.anisotropy = 4;
    const out = /** @type {any} */ (mat.clone());
    out.map = tex;
    return out;
  } catch (err) {
    console.warn('The courier’s shirt could not be repainted.', err);
    return mat;
  }
}

/**
 * Dark sunglasses fixed to the head bone, placed from the head mesh's bounds in the rest pose
 * (the avatar faces +z): the lenses sit about 11.5 cm under the crown, just behind the nose tip.
 * @param {THREE.Object3D} scene
 * @param {number} baseHeight the avatar's height in its own units (about 1.8 m tall)
 */
function addSunglasses(scene, baseHeight) {
  scene.updateMatrixWorld(true);
  /** @type {any} */
  let bone = null;
  /** @type {any} */
  let headMesh = null;
  scene.traverse((o) => {
    const m = /** @type {any} */ (o);
    if (o.name === 'Bip01_Head') bone = o;
    if (m.isMesh && m.material && /_head$/i.test(m.material.name || '')) headMesh = m;
  });
  if (!bone || !headMesh) return;
  const box = new THREE.Box3().setFromObject(headMesh, true);
  if (box.isEmpty()) return;
  const u = baseHeight / 1.8;
  const parts = [];
  const add = (w, hh, dd, x, y, z, rotY = 0) => {
    const g = new THREE.BoxGeometry(w, hh, dd);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    parts.push(g);
  };
  // Two lenses, the bridge and the temples running back over the ears.
  add(0.056, 0.042, 0.012, -0.034, 0, 0);
  add(0.056, 0.042, 0.012, 0.034, 0, 0);
  add(0.016, 0.008, 0.01, 0, 0.012, 0);
  add(0.006, 0.008, 0.11, -0.066, 0.008, -0.055);
  add(0.006, 0.008, 0.11, 0.066, 0.008, -0.055);
  const geo = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  if (!geo) return;
  const glasses = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#08090b', roughness: 0.12, metalness: 0.7 }));
  glasses.name = 'sunglasses';
  glasses.castShadow = false;
  glasses.scale.setScalar(u);
  const c = box.getCenter(new THREE.Vector3());
  // Without a parent its transform is taken as world space; attach() keeps it under the bone.
  glasses.position.set(c.x, box.max.y - 0.115 * u, box.max.z - 0.022 * u);
  glasses.updateMatrix();
  bone.attach(glasses);
}

// ---------------------------------------------------------------------------------------------
// Set dressing
// ---------------------------------------------------------------------------------------------

/**
 * Builds the hotel with its pool deck, the shooter's roof, the blocks and streets in between and
 * the neighbouring towers. Repeated parts are merged per material or instanced: about 45 draw
 * calls in all. Sketchfab props (test-only, sketchfab.json) fall back to simple shapes.
 * @param {THREE.Scene} scene
 */
export async function poolDress(scene) {
  const group = new THREE.Group();
  group.name = 'pool-dressing';
  dressed = group;
  if (scene) hideSkyline(scene);
  const colliders = poolColliders();
  /** @type {THREE.Object3D[]} */
  const rangeMeshes = [];

  const [downtown, plantsPack, loungerBaked, umbrellaBaked, loungeBaked, treeGltf] = await Promise.all([
    loadPack('downtown_towers'),
    loadPack('pool_plants'),
    loadBaked('pool_lounger'),
    loadBaked('pool_umbrella'),
    loadBaked('pool_lounge_set'),
    loadGLTF('./models/props/tree.glb').catch(() => null)
  ]);

  const mats = makeMaterials();
  /** @type {Map<THREE.Material, THREE.BufferGeometry[]>} */
  const parts = new Map();
  const add = (mat, geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (!parts.has(mat)) parts.set(mat, []);
    parts.get(mat).push(g);
  };
  /** A box from corner to corner, with UVs in world metres divided by `tile`. */
  const box = (mat, x0, y0, z0, x1, y1, z1, tile = 1) => {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    worldUV(g, tile);
    add(mat, g);
  };
  /** A building: facade walls in the style's material, the roof in the shared roof material. */
  const building = (x, z, w, d, h, style) => {
    const g = buildingGeometry(w, h, d);
    g.translate(x, h / 2, z);
    add(facadeMaterial(style), pickGroups(g, [0, 1, 4, 5]));
    add(mats.roof, pickGroups(g, [2]));
    g.dispose();
  };

  const H = POOL.hotel;
  const W = POOL.water;
  const y = POOL.deckY;

  // ---------- the shooter's roof ----------
  const S = POOL.shooter;
  building((S.x0 + S.x1) / 2, (S.z0 + S.z1) / 2, S.x1 - S.x0, S.z1 - S.z0, S.roof, 'glassBlue');
  const p = S.roof + S.parapet;
  box(mats.concrete, S.x0, S.roof, S.z0, S.x1, p, S.z0 + 0.4);
  box(mats.concrete, S.x0, S.roof, S.z1 - 0.4, S.x1, p, S.z1);
  box(mats.concrete, S.x0, S.roof, S.z0, S.x0 + 0.4, p, S.z1);
  box(mats.concrete, S.x1 - 0.4, S.roof, S.z0, S.x1, p, S.z1);
  box(mats.concrete, S.x0 - 0.15, p, S.z0 - 0.15, S.x1 + 0.15, p + 0.08, S.z0 + 0.45);
  // Roof units well behind the firing position.
  box(mats.metal, -152, S.roof, 274, -146.5, S.roof + 1.6, 278);
  box(mats.metal, -144, S.roof, 280, -140, S.roof + 2.2, 284);

  // ---------- the hotel tower ----------
  building((H.x0 + H.x1) / 2, (H.z0 + H.z1) / 2, H.x1 - H.x0, H.z1 - H.z0, H.top, 'stone');
  // Deck slabs around the pool (stone sides read as the crown), plank decking on top.
  box(mats.stone, H.x0 - 0.2, H.top, H.z0 - 0.2, H.x1 + 0.2, y - 0.02, W.z0, 2);
  box(mats.stone, H.x0 - 0.2, H.top, W.z1, H.x1 + 0.2, y - 0.02, H.z1 + 0.2, 2);
  box(mats.stone, H.x0 - 0.2, H.top, W.z0, W.x0, y - 0.02, W.z1, 2);
  box(mats.stone, W.x1, H.top, W.z0, H.x1 + 0.2, y - 0.02, W.z1, 2);
  for (const [x0, z0, x1, z1] of [[H.x0, H.z0, H.x1, W.z0 - 0.4], [H.x0, W.z1 + 0.4, H.x1, H.z1], [H.x0, W.z0 - 0.4, W.x0 - 0.4, W.z1 + 0.4], [W.x1 + 0.4, W.z0 - 0.4, H.x1, W.z1 + 0.4]]) {
    box(mats.planks, x0, y - 0.03, z0, x1, y, z1, 2.4);
  }
  // Pool coping, tiled basin, steps at the east end.
  box(mats.stone, W.x0 - 0.4, y - 0.03, W.z0 - 0.4, W.x1 + 0.4, y + 0.04, W.z0, 1);
  box(mats.stone, W.x0 - 0.4, y - 0.03, W.z1, W.x1 + 0.4, y + 0.04, W.z1 + 0.4, 1);
  box(mats.stone, W.x0 - 0.4, y - 0.03, W.z0, W.x0, y + 0.04, W.z1, 1);
  box(mats.stone, W.x1, y - 0.03, W.z0, W.x1 + 0.4, y + 0.04, W.z1, 1);
  box(mats.tiles, W.x0, W.floor - 0.06, W.z0, W.x1, W.floor, W.z1, 1);
  box(mats.tiles, W.x0, W.floor, W.z0, W.x1, y - 0.03, W.z0 + 0.04, 1);
  box(mats.tiles, W.x0, W.floor, W.z1 - 0.04, W.x1, y - 0.03, W.z1, 1);
  box(mats.tiles, W.x0, W.floor, W.z0, W.x0 + 0.04, y - 0.03, W.z1, 1);
  box(mats.tiles, W.x1 - 0.04, W.floor, W.z0, W.x1, y - 0.03, W.z1, 1);
  const stepZ0 = 73.5;
  const stepZ1 = 79.5;
  [[W.x1 - 0.8, 55.8], [W.x1 - 1.6, 55.52], [W.x1 - 2.4, 55.26]].forEach(([x0, top]) => {
    box(mats.tiles, x0, W.floor, stepZ0, W.x1 - 0.04, top, stepZ1, 1);
  });
  // Water: a tinted, slightly see-through plane with drifting ripples.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W.x1 - W.x0, W.z1 - W.z0), mats.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set((W.x0 + W.x1) / 2, W.y, (W.z0 + W.z1) / 2);
  water.renderOrder = 2;
  const ripples = /** @type {THREE.Texture} */ (mats.water.normalMap);
  water.onBeforeRender = () => {
    const t = performance.now() * 0.001;
    ripples.offset.set((t * 0.018) % 1, (t * 0.011) % 1);
  };
  group.add(water);

  // Stone curb and glass railing round the deck (gaps for the lift house and the service hut).
  const c = y + 0.3;
  box(mats.stone, H.x0, y, H.z1 - 0.3, H.x1, c, H.z1, 1);
  box(mats.stone, H.x0, y, H.z0, H.x1, c, H.z0 + 0.3, 1);
  box(mats.stone, H.x0, y, H.z0, H.x0 + 0.3, c, H.z1, 1);
  box(mats.stone, H.x1 - 0.3, y, H.z0, H.x1, c, H.z1, 1);
  const L = POOL.lift;
  const SV = POOL.service;
  const railTop = c + 1.0;
  /** Runs of railing: [x0, z0, x1, z1]. */
  const runs = [
    [H.x0 + 0.15, H.z1 - 0.15, H.x1 - 0.15, H.z1 - 0.15],
    [H.x1 - 0.15, SV.z1, H.x1 - 0.15, H.z1 - 0.15],
    [H.x0 + 0.15, L.z1, H.x0 + 0.15, H.z1 - 0.15],
    [L.x1, H.z0 + 0.15, SV.x0, H.z0 + 0.15]
  ];
  for (const [x0, z0, x1, z1] of runs) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const t = 0.012;
    if (alongX) {
      box(mats.glass, x0, c, z0 - t, x1, railTop, z0 + t);
      box(mats.metal, x0, railTop, z0 - 0.03, x1, railTop + 0.05, z0 + 0.03);
    } else {
      box(mats.glass, x0 - t, c, z0, x0 + t, railTop, z1);
      box(mats.metal, x0 - 0.03, railTop, z0, x0 + 0.03, railTop + 0.05, z1);
    }
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i <= n; i++) {
      const px = x0 + ((x1 - x0) * i) / n;
      const pz = z0 + ((z1 - z0) * i) / n;
      box(mats.metal, px - 0.025, c, pz - 0.025, px + 0.025, railTop, pz + 0.025);
    }
  }

  // Lift and stair house with sliding glass doors on its east face; the service stair hut.
  box(mats.plaster, L.x0, y, L.z0, L.x1, y + L.h, L.z1, 2);
  box(mats.stone, L.x0 - 0.15, y + L.h, L.z0 - 0.15, L.x1 + 0.15, y + L.h + 0.25, L.z1 + 0.15, 2);
  box(mats.metal, L.x0 + 2, y + L.h + 0.25, L.z0 + 1.5, L.x0 + 6, y + L.h + 1.6, L.z0 + 5.5);
  box(mats.dark, L.x1, y, POOL.door.z - 1.0, L.x1 + 0.04, y + 2.35, POOL.door.z + 1.0);
  box(mats.metal, L.x1, y + 2.35, POOL.door.z - 1.1, L.x1 + 0.06, y + 2.45, POOL.door.z + 1.1);
  box(mats.stone, L.x1, y + 2.7, POOL.door.z - 2.2, L.x1 + 1.6, y + 2.85, POOL.door.z + 2.2);
  box(mats.plaster, SV.x0, y, SV.z0, SV.x1, y + SV.h, SV.z1, 2);
  box(mats.dark, POOL.serviceDoor.x - 0.5, y, SV.z1, POOL.serviceDoor.x + 0.5, y + 2.1, SV.z1 + 0.04);

  // Bar: wooden counter with a stone top, back bar with dark shelves and bottles.
  const B = POOL.bar;
  const BB = POOL.backBar;
  box(mats.wood, B.x0, y, B.z0, B.x1, y + B.h - 0.06, B.z1, 1);
  box(mats.marble, B.x0 - 0.1, y + B.h - 0.06, B.z0 - 0.08, B.x1 + 0.1, y + B.h, B.z1 + 0.12, 1);
  box(mats.dark, BB.x0, y, BB.z0, BB.x1, y + BB.h, BB.z1, 1);
  box(mats.wood, BB.x0 - 0.1, y + BB.h, BB.z0 - 0.05, BB.x1 + 0.1, y + BB.h + 0.1, BB.z1 + 0.1, 1);
  for (let x = BB.x0 + 0.3; x < BB.x1 - 0.2; x += 0.42) {
    for (const shelf of [0.95, 1.45]) {
      const k = Math.floor((x - BB.x0) / 0.42 + shelf * 3) % 3;
      box(k === 0 ? mats.bottleGreen : k === 1 ? mats.bottleAmber : mats.glass, x - 0.04, y + shelf, BB.z1, x + 0.04, y + shelf + 0.3, BB.z1 + 0.08);
    }
  }

  // Lifeguard chair: white frame, platform and a small sun roof.
  const LG = POOL.lifeguard;
  for (const [dx, dz] of [[-0.45, -0.4], [0.45, -0.4], [-0.45, 0.4], [0.45, 0.4]]) {
    box(mats.plaster, LG.x + dx - 0.04, y, LG.z + dz - 0.04, LG.x + dx + 0.04, y + LG.h + 1.9, LG.z + dz + 0.04);
  }
  box(mats.plaster, LG.x - 0.5, y + LG.h - 0.1, LG.z - 0.45, LG.x + 0.5, y + LG.h, LG.z + 0.45);
  box(mats.canvas, LG.x - 0.65, y + LG.h + 1.9, LG.z - 0.6, LG.x + 0.65, y + LG.h + 1.98, LG.z + 0.6);

  // Hotel name high on the south face (an invented hotel).
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(15, 3), mats.sign);
  sign.position.set((H.x0 + H.x1) / 2, H.top - 3.2, H.z1 + 0.05);
  group.add(sign);

  // ---------- streets and blocks between the towers ----------
  for (const [x0, z0, x1, z1] of PLINTHS) box(mats.pavement, x0, 0, z0, x1, 0.15, z1, 3);
  for (let x = -336; x < -150; x += 6) {
    if (x > -262 && x < -240) continue;
    box(mats.paint, x, 0.01, 110.85, x + 3, 0.03, 111.15);
    box(mats.paint, x, 0.01, 184.85, x + 3, 0.03, 185.15);
  }
  for (let z = 44; z < 300; z += 6) {
    if ((z > 100 && z < 122) || (z > 174 && z < 196)) continue;
    box(mats.paint, -251.15, 0.01, z, -250.85, 0.03, z + 3);
  }
  for (const [x, z, w, d, h, style] of BLOCKS) building(x, z, w, d, h, style);

  // Neighbouring towers: Sketchfab buildings when the pack is there, facade boxes otherwise.
  for (const n of NEIGHBOURS) {
    const part = downtown && downtown.parts.get(n.name);
    if (part) {
      const obj = placePart(group, part, { x: n.x, z: n.z });
      const solid = solidOf(obj);
      colliders.push(solid.box);
      rangeMeshes.push(...solid.meshes);
    } else {
      building(n.x, n.z, n.w, n.d, n.h, n.style);
      colliders.push([n.x - n.w / 2, 0, n.z - n.d / 2, n.x + n.w / 2, n.h, n.z + n.d / 2]);
    }
  }

  // ---------- deck furniture ----------
  const spots = POOL.loungers.map((s) => ({ x: s.x, z: s.z, rot: s.rot, y }));
  if (loungerBaked) {
    alignLongAxis(loungerBaked);
    normalise(loungerBaked, { length: 1.95 });
    addInstances(group, loungerBaked, spots);
  } else {
    for (const s of spots) fallbackLounger(box, mats, s.x, s.z, s.rot, y);
  }
  const shades = POOL.umbrellas.map((s) => ({ x: s.x, z: s.z, rot: 0, y }));
  if (umbrellaBaked) {
    normalise(umbrellaBaked, { height: 2.6 });
    addInstances(group, umbrellaBaked, shades);
  } else {
    for (const s of shades) fallbackUmbrella(add, mats, s.x, s.z, y);
  }
  const L2 = POOL.lounge;
  if (loungeBaked) {
    normalise(loungeBaked, { length: 4.2 });
    addInstances(group, loungeBaked, [{ x: L2.x, z: L2.z, rot: L2.rot, y }]);
  } else {
    box(mats.wood, L2.x - 0.45, y, L2.z - 1.1, L2.x + 0.45, y + 0.4, L2.z + 1.1);
    box(mats.canvas, L2.x + 0.2, y + 0.4, L2.z - 1.1, L2.x + 0.45, y + 0.85, L2.z + 1.1);
    box(mats.wood, L2.x - 1.8, y, L2.z - 0.6, L2.x - 0.9, y + 0.4, L2.z + 0.6);
  }
  // Planters: the two tallest plants of the Sketchfab pack, or pots with leafy crowns.
  const plantParts = plantsPack ? [...plantsPack.parts.values()]
    .map((part) => ({ part, size: partSize(part) }))
    .filter((e) => e.size.y > 0.05)
    .sort((a, b) => b.size.y - a.size.y)
    .slice(0, 2) : [];
  if (plantParts.length) {
    plantParts.forEach((e, k) => {
      const list = POOL.plants.filter((_, i) => i % plantParts.length === k)
        .map(([x, z], i) => ({ x, z, y, rot: i * 1.3, s: (1.15 + ((i * 37) % 5) * 0.06) / e.size.y }));
      instancePart(group, e.part, list);
    });
  } else {
    for (const [x, z] of POOL.plants) {
      box(mats.pot, x - 0.32, y, z - 0.32, x + 0.32, y + 0.55, z + 0.32);
      const crown = new THREE.IcosahedronGeometry(0.5, 1);
      crown.translate(x, y + 1.0, z);
      add(mats.leaves, crown);
    }
  }

  // Street trees along the two east-west streets.
  const treeSpots = [];
  for (let x = -332; x <= -156; x += 14) {
    if (x > -262 && x < -240) continue;
    for (const z of [102.6, 119.4, 176.6, 193.4]) treeSpots.push({ x: x + (z > 150 ? 7 : 0), z });
  }
  plantStreetTrees(group, treeGltf, treeSpots);

  // Merge everything per material: one draw call each.
  for (const [mat, list] of parts) {
    const geo = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, mat);
    const see = mat === mats.glass || mat === mats.paint;
    mesh.castShadow = !see;
    mesh.receiveShadow = true;
    if (mat === mats.glass) mesh.renderOrder = 3;
    group.add(mesh);
    if (!see) rangeMeshes.push(mesh);
  }
  rangeMeshes.push(water);
  scene.add(group);
  return { group, colliders, rangeMeshes };
}

/** Puts the hidden skyline boxes back once this contract's dressing has left the scene. */
export function poolUndress() {
  if (!hidden || (dressed && dressed.parent)) return;
  const meshes = new Set();
  for (const h of hidden) {
    h.mesh.setMatrixAt(h.i, h.m);
    meshes.add(h.mesh);
  }
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  hidden = null;
}

/** Hides the city's distant skyline boxes (instanced, tens of metres big) in this district. */
function hideSkyline(scene) {
  if (hidden) return;
  hidden = [];
  const Z = SKYLINE_ZONE;
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const o of scene.children) {
    const obj = /** @type {any} */ (o);
    if (!obj.isInstancedMesh) continue;
    let touched = false;
    for (let i = 0; i < obj.count; i++) {
      obj.getMatrixAt(i, m);
      m.decompose(pos, quat, scl);
      if (scl.x < 20 || scl.y < 20) continue;
      if (pos.x < Z.x0 || pos.x > Z.x1 || pos.z < Z.z0 || pos.z > Z.z1) continue;
      hidden.push({ mesh: obj, i, m: m.clone() });
      obj.setMatrixAt(i, zero);
      touched = true;
    }
    if (touched) {
      obj.instanceMatrix.needsUpdate = true;
      obj.computeBoundingSphere();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/**
 * A whole Sketchfab model baked into one geometry per material, or null when it is missing.
 * @param {string} name
 */
async function loadBaked(name) {
  try {
    const gltf = await loadGLTF(SKETCHFAB + name + '.glb');
    const baked = bakeByMaterial(gltf.scene);
    for (const mat of baked.keys()) {
      const sm = /** @type {any} */ (mat);
      if (sm.isMeshStandardMaterial) sm.envMapIntensity = 0.9;
    }
    return baked.size ? baked : null;
  } catch (err) {
    console.warn('Sketchfab model ' + name + ' did not load; using simple shapes.', err);
    return null;
  }
}

/**
 * Turns a baked lounger so its long side runs along z with the raised backrest at +z.
 * @param {Map<THREE.Material, THREE.BufferGeometry>} baked
 */
function alignLongAxis(baked) {
  const box = new THREE.Box3();
  for (const g of baked.values()) {
    g.computeBoundingBox();
    box.union(g.boundingBox);
  }
  const size = box.getSize(new THREE.Vector3());
  const turn = new THREE.Matrix4();
  if (size.x > size.z) {
    turn.makeRotationY(Math.PI / 2);
    for (const g of baked.values()) g.applyMatrix4(turn);
    box.makeEmpty();
    for (const g of baked.values()) {
      g.computeBoundingBox();
      box.union(g.boundingBox);
    }
  }
  // The end with the highest points is the backrest.
  const mid = (box.min.z + box.max.z) / 2;
  let front = -Infinity;
  let back = -Infinity;
  for (const g of baked.values()) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const yy = pos.getY(i);
      if (pos.getZ(i) > mid) back = Math.max(back, yy);
      else front = Math.max(front, yy);
    }
  }
  if (front > back) {
    turn.makeRotationY(Math.PI);
    for (const g of baked.values()) g.applyMatrix4(turn);
  }
}

/**
 * One InstancedMesh per material for the given spots.
 * @param {THREE.Object3D} parent
 * @param {Map<THREE.Material, THREE.BufferGeometry>} baked
 * @param {{ x: number, z: number, y: number, rot: number }[]} spots
 */
function addInstances(parent, baked, spots) {
  const set = instanced(baked, spots.length);
  spots.forEach((s, i) => set.set(i, place(s.x, s.y, s.z, s.rot, 1)));
  set.finish();
  parent.add(set.group);
}

/**
 * Street trees from the CC-BY tree model (first variant only: one or two draw calls).
 * @param {THREE.Object3D} parent
 * @param {any} gltf
 * @param {{ x: number, z: number }[]} spots
 */
function plantStreetTrees(parent, gltf, spots) {
  if (!gltf || !spots.length) return;
  /** @type {any} */
  let first = null;
  gltf.scene.traverse((o) => {
    if (!first && /** @type {any} */ (o).isMesh) first = o;
  });
  if (!first) return;
  const baked = bakeByMaterial(gltf.scene, (mesh) => mesh === first);
  if (!baked.size) return;
  normalise(baked, { height: 1 });
  const set = instanced(baked, spots.length);
  spots.forEach((s, i) => set.set(i, place(s.x, 0.15, s.z, i * 2.1, 7 + ((i * 7) % 5) * 0.5)));
  set.finish();
  parent.add(set.group);
}

/** A white lounger from boxes: base, mattress and a raised backrest at the +z end. */
function fallbackLounger(box, mats, x, z, rot, y) {
  const along = Math.abs(Math.sin(rot)) > 0.5;
  const hw = 0.34;
  const hl = 0.97;
  const [ax, az] = along ? [hl, hw] : [hw, hl];
  box(mats.plaster, x - ax, y + 0.12, z - az, x + ax, y + 0.32, z + az);
  box(mats.canvas, x - ax + 0.04, y + 0.32, z - az + 0.04, x + ax - 0.04, y + 0.38, z + az - 0.04);
  if (along) box(mats.plaster, x + hl - 0.5, y + 0.32, z - hw, x + hl - 0.4, y + 0.95, z + hw);
  else box(mats.plaster, x - hw, y + 0.32, z + hl - 0.5, x + hw, y + 0.95, z + hl - 0.4);
}

/** A white umbrella from a pole and a shallow cone. */
function fallbackUmbrella(add, mats, x, z, y) {
  const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8);
  pole.translate(x, y + 1.25, z);
  add(mats.metal, pole);
  const top = new THREE.ConeGeometry(1.4, 0.45, 12, 1, true);
  top.translate(x, y + 2.35, z);
  add(mats.canvas, top);
}

/**
 * Sets a box's UVs to world metres divided by `tile`, by face direction.
 * @param {THREE.BufferGeometry} g
 * @param {number} tile
 */
function worldUV(g, tile) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
    else if (nx > 0.5) uv.setXY(i, pos.getZ(i) / tile, pos.getY(i) / tile);
    else uv.setXY(i, pos.getX(i) / tile, pos.getY(i) / tile);
  }
  uv.needsUpdate = true;
}

/**
 * The triangles of some material groups of an indexed geometry, as a new non-indexed geometry
 * (BoxGeometry groups: 0-1 and 4-5 are the sides, 2 the top, 3 the bottom).
 * @param {THREE.BufferGeometry} geo
 * @param {number[]} keep
 */
function pickGroups(geo, keep) {
  const flat = geo.toNonIndexed();
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = flat.attributes[name];
    const n = a.itemSize;
    /** @type {number[]} */
    const arr = [];
    for (const gr of geo.groups) {
      if (!keep.includes(gr.materialIndex)) continue;
      for (let i = gr.start; i < gr.start + gr.count; i++) {
        for (let k = 0; k < n; k++) arr.push(a.array[i * n + k]);
      }
    }
    out.setAttribute(name, new THREE.Float32BufferAttribute(arr, n));
  }
  flat.dispose();
  return out;
}

function makeMaterials() {
  const std = (color, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  const water = new THREE.MeshStandardMaterial({
    color: '#47b9d3', roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.8,
    normalMap: rippleTexture(), normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.4
  });
  const ripples = /** @type {THREE.Texture} */ (water.normalMap);
  ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping;
  ripples.repeat.set(5, 2.5);
  return {
    roof: std('#8d8a85', 0.95),
    concrete: std('#a5a29c', 0.9),
    stone: std('#ddd6ca', 0.8),
    planks: std('#ffffff', 0.78, { map: canvasTexture(plankDraw) }),
    tiles: std('#ffffff', 0.35, { map: canvasTexture(tileDraw) }),
    water,
    glass: new THREE.MeshStandardMaterial({ color: '#b5dde2', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.28, depthWrite: false }),
    metal: new THREE.MeshStandardMaterial({ color: '#c8ccd1', roughness: 0.3, metalness: 0.8 }),
    plaster: std('#efebe4', 0.85),
    dark: new THREE.MeshStandardMaterial({ color: '#1d2227', roughness: 0.2, metalness: 0.6 }),
    wood: std('#6c4a33', 0.6),
    marble: std('#ece8e1', 0.22),
    canvas: std('#f4f1ea', 0.9),
    pot: std('#4b4f55', 0.8),
    leaves: std('#3b5e33', 1),
    bottleGreen: new THREE.MeshStandardMaterial({ color: '#2f6b3c', roughness: 0.15, metalness: 0.2 }),
    bottleAmber: new THREE.MeshStandardMaterial({ color: '#9a5a1c', roughness: 0.15, metalness: 0.2 }),
    pavement: std('#aaa69e', 0.9, { map: canvasTexture(pavementDraw) }),
    paint: std('#e9e6dc', 0.7),
    sign: new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.6, transparent: true })
  };
}

/** @param {(g: CanvasRenderingContext2D, s: number) => void} draw */
function canvasTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  draw(c.getContext('2d'), 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Teak decking: eight planks per tile with seams and staggered butt joints. */
function plankDraw(g, s) {
  g.fillStyle = '#9b7352';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,225,190,0.07)' : 'rgba(60,30,10,0.07)';
    g.fillRect(i * 32, 0, 30, s);
    g.fillStyle = 'rgba(40,24,12,0.55)';
    g.fillRect(i * 32 + 30, 0, 2, s);
    g.fillRect(i * 32, ((i * 89) % 200) + 20, 30, 2);
  }
}

/** Small pale-blue pool tiles. */
function tileDraw(g, s) {
  g.fillStyle = '#d8eef2';
  g.fillRect(0, 0, s, s);
  const n = 8;
  const t = s / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      g.fillStyle = (i * 7 + j * 3) % 5 === 0 ? '#9fd3de' : (i + j) % 3 === 0 ? '#b9e2ea' : '#c8e8ee';
      g.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
    }
  }
}

/** Light paving slabs. */
function pavementDraw(g, s) {
  g.fillStyle = '#b4b0a8';
  g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i <= 4; i++) {
    g.fillRect(i * (s / 4) - 1, 0, 2, s);
    g.fillRect(0, i * (s / 4) - 1, s, 2);
  }
}

/** The hotel's name in brushed letters (an invented hotel). */
function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 205;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#c9a45c';
  g.font = '600 150px "Rajdhani", "Arial Narrow", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('CASSIAN', 512, 108);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A tiling normal map of small ripples for the pool. */
function rippleTexture() {
  const n = 64;
  const hgt = new Float32Array(n * n);
  for (let yy = 0; yy < n; yy++) {
    for (let xx = 0; xx < n; xx++) {
      const u = (xx / n) * Math.PI * 2;
      const v = (yy / n) * Math.PI * 2;
      hgt[yy * n + xx] = Math.sin(u * 2 + v) * 0.5 + Math.sin(u * 3 - v * 2) * 0.3 + Math.sin(v * 5 + u) * 0.2;
    }
  }
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  for (let yy = 0; yy < n; yy++) {
    for (let xx = 0; xx < n; xx++) {
      const dx = hgt[yy * n + ((xx + 1) % n)] - hgt[yy * n + ((xx + n - 1) % n)];
      const dy = hgt[((yy + 1) % n) * n + xx] - hgt[((yy + n - 1) % n) * n + xx];
      const l = Math.hypot(dx * 2, dy * 2, 1);
      const i = (yy * n + xx) * 4;
      img.data[i] = Math.round(((-dx * 2) / l * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round(((-dy * 2) / l * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}
