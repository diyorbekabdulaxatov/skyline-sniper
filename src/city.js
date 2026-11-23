// @ts-check
// The city around Harbor Plaza at golden hour: streets, the plaza with its fountain, glass and
// stone towers with reflective facades, brick and plaster mid-rises with shops, busy rooftops,
// billboards, trees, traffic lights, traffic, the harbour to the east and a skyline beyond.
// Units are metres. Axes: x right (east), y up, z toward the player (south); north is -z.
import * as THREE from 'three';
import { facadeMaterial, buildingGeometry, rng, STYLES } from './facades.js';
import { loadGroundMaterial, loadProp, placeProp, loadGLTF } from './assets.js';
import { bakeByMaterial, normalise, instanced, place } from './instancing.js';
import { createDecor } from './blocks.js';
import { buildHarbor, HARBOR } from './harbor.js';
import { loadPack, fitScale, partSize, placePart, solidOf, instancePart } from './sketchfab.js';

/** Fixed layout the people and mission code also use. */
export const LAYOUT = {
  roofY: 42,
  eye: { x: 0, y: 43.7, z: -1.0 },
  walkY: 0.15,
  plaza: { x0: -45, x1: 45, z0: -104, z1: -26 },
  fountain: { x: 0, z: -62, r: 7 },
  avenue: { z0: -22, z1: -6 },
  north: { z0: -122, z1: -108 },
  meridianDoor: { x: 10, z: -127 },
  targetCar: { x: 24, z: -109.6 }
};

/** East edge of the streets: the quay road, then the promenade, then water at HARBOR.quayX. */
const QUAY_ROAD = { x0: 126, x1: 142 };

/**
 * Glass and stone towers with procedural facades: x, z, width, depth, height, style.
 * @type {[number, number, number, number, number, string][]}
 */
const TOWERS = [
  // Our building (the player's roof) and its neighbours on the south side of the avenue.
  [0, 12, 30, 28, LAYOUT.roofY, 'stone'],
  [37, 16, 34, 34, 56, 'office'],
  [-80, 18, 44, 38, 72, 'glassBlue'],
  [84, 18, 44, 38, 38, 'concrete'],
  // West block.
  [-78, -88, 28, 30, 86, 'glassGreen'],
  [-118, -64, 36, 70, 60, 'stone'],
  // Meridian Tower, the target's office, and the downtown towers behind it.
  [10, -152, 42, 50, 128, 'glassBlue'],
  [-86, -152, 38, 50, 124, 'glassGreen'],
  [-20, -230, 46, 48, 182, 'glassGreen'],
  [44, -236, 40, 44, 92, 'concrete'],
  [-90, -232, 44, 44, 98, 'office'],
  [110, -228, 46, 44, 146, 'glassBlue']
];

/**
 * Brick and plaster mid-rises with shops: x, z, width, depth, height, wall, shop faces.
 * The east side stays low so the player sees over it to the harbour.
 * @type {[number, number, number, number, number, string, string][]}
 */
const BLOCKS = [
  [-36, 16, 34, 34, 24, 'brick_red', 'n'],
  [-78, -46, 28, 36, 22, 'plaster', 'e'],
  [74, -40, 22, 28, 16, 'brick_red', 'w'],
  [74, -70, 22, 24, 20, 'plaster', 'w'],
  [74, -95, 22, 18, 13, 'brick_old', 'w'],
  [108, -45, 24, 34, 22, 'brick_old', 'e'],
  [108, -85, 24, 34, 18, 'brick_red', 'e'],
  [-42, -148, 34, 42, 28, 'brick_old', 's'],
  [58, -150, 32, 46, 26, 'plaster', 's'],
  [102, -150, 34, 46, 18, 'brick_red', 'sw']
];

/**
 * Realistic Sketchfab buildings (downtown_towers pack) that replace procedural ones by index when
 * the pack is present. Scaled uniformly to fit the footprint; colliders follow the model.
 * The Gala block (BLOCKS[8]) and the buildings behind the player stay procedural.
 */
const TOWER_MODELS = { 4: 'Downtown_ModernOffice_1_B', 5: 'Downtown_Flatiron_1', 6: 'Downtown_ModernOffice_5', 7: 'Downtown_ModernOffice_4', 9: 'Downtown_ArtDeco_1' };
const BLOCK_MODELS = {
  1: 'Downtown_Residential_3', 2: 'Downtown_Mall_1', 3: 'Downtown_PublicBuilding_1', 4: 'Downtown_Brutal_1',
  5: 'Downtown_Residential_4', 6: 'Downtown_Residential_2', 7: 'Downtown_ClassicOffice_1', 9: 'Downtown_BrownstoneOffice_1'
};
/** Meridian Tower (TOWERS[6]) keeps its front face on the target's door line. */
const MERIDIAN_FRONT_Z = -127;

/** Plaster tints so neighbouring plaster blocks differ. */
const PLASTER_TINTS = ['#f1e6d2', '#e8cfa8', '#d9e0e3', '#efd9c8'];

/**
 * @param {THREE.Scene} scene
 * @param {import('./assets.js').Manifest | null} manifest
 */
export async function buildCity(scene, manifest) {
  const r = rng(2026);
  /** Solid boxes for bullets: [minX, minY, minZ, maxX, maxY, maxZ]. */
  const colliders = [];
  /** Meshes the rangefinder measures to. */
  const rangeMeshes = [];

  /** Objects the game hides when a contract's vantage cannot see them (see game.js). */
  const cullables = [];
  const [downtown, props1, props2, containerPack] = await Promise.all(['downtown_towers', 'city_props_1', 'city_props_2', 'containers_textured'].map(loadPack));
  /**
   * Places a Sketchfab building in a footprint slot; returns false when the part is missing.
   * @param {string} name @param {number} x @param {number} z @param {number} w @param {number} d
   * @param {number | null} frontZ keep the south face on this line
   */
  const modelBuilding = (name, x, z, w, d, frontZ) => {
    const part = downtown && downtown.parts.get(name);
    if (!part) return false;
    const fit = fitScale(part, w, d);
    let cz = z;
    if (frontZ !== null) {
      const size = partSize(part);
      cz = frontZ - ((fit.rot ? size.x : size.z) * fit.s) / 2;
    }
    const obj = placePart(scene, part, { x, z: cz, rot: fit.rot, s: fit.s });
    const solid = solidOf(obj);
    colliders.push(solid.box);
    rangeMeshes.push(...solid.meshes);
    cullables.push(obj);
    return true;
  };
  /** Which procedural buildings were replaced, so their decor and billboards are skipped. */
  const replacedBlocks = new Set();

  const [asphalt, sidewalk, roof, plazaTiles, brickRed, brickOld, plaster] = await Promise.all([
    loadGroundMaterial(manifest, 'asphalt', 6),
    loadGroundMaterial(manifest, 'sidewalk', 3),
    loadGroundMaterial(manifest, 'roof', 4),
    loadGroundMaterial(manifest, 'plaza', 4),
    loadGroundMaterial(manifest, 'brick_red', 1),
    loadGroundMaterial(manifest, 'brick_old', 3),
    loadGroundMaterial(manifest, 'plaster', 2)
  ]);
  const mats = {
    asphalt: asphalt || new THREE.MeshStandardMaterial({ color: '#3b3d40', roughness: 0.95 }),
    sidewalk: sidewalk || new THREE.MeshStandardMaterial({ color: '#a7a39b', roughness: 0.9 }),
    roof: roof || new THREE.MeshStandardMaterial({ color: '#8e8c87', roughness: 0.95 }),
    plaza: plazaTiles || new THREE.MeshStandardMaterial({ color: '#c9c2b4', roughness: 0.8 }),
    curb: new THREE.MeshStandardMaterial({ color: '#b9b5ad', roughness: 0.85 }),
    paint: new THREE.MeshStandardMaterial({ color: '#e9e6dc', roughness: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.5, metalness: 0.7 }),
    trunk: new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: '#2d4f57', roughness: 0.05, metalness: 0.35, envMapIntensity: 1.4 }),
    stone: new THREE.MeshStandardMaterial({ color: '#cfc6b6', roughness: 0.85 })
  };
  /** @type {Record<string, THREE.Material>} */
  const walls = {
    brick_red: brickRed || new THREE.MeshStandardMaterial({ color: '#8c4f3d', roughness: 0.9 }),
    brick_old: brickOld || new THREE.MeshStandardMaterial({ color: '#9a6a4f', roughness: 0.9 }),
    plaster: plaster || new THREE.MeshStandardMaterial({ color: '#e2d6c2', roughness: 0.9 })
  };
  const wallTile = { brick_red: 1, brick_old: 3, plaster: 2 };

  // ---------- ground: land up to the quay; water and the pier are built by harbor.js ----------
  const landW = HARBOR.quayX + 2000;
  const ground = slab(landW, 4000, 0.02, mats.asphalt, HARBOR.quayX - landW / 2, 0, -0.02);
  ground.receiveShadow = true;
  scene.add(ground);
  rangeMeshes.push(ground);

  const walk = LAYOUT.walkY;
  const p = LAYOUT.plaza;
  addSlab(scene, rangeMeshes, p.x1 - p.x0, p.z1 - p.z0, walk, mats.plaza, (p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, 0);
  const east = QUAY_ROAD.x0;
  const sidewalks = [
    // avenue, both sides
    [-400, east, -6, -2], [-400, -45, -26, -22], [45, east, -26, -22], [-45, 45, -26, -22],
    // Meridian Street, both sides
    [-400, east, -108, -104], [-400, east, -126, -122],
    // cross streets
    [41, 45, -104, -26], [59, 63, -104, -26], [-45, -41, -104, -26], [-63, -59, -104, -26],
    // waterfront promenade
    [QUAY_ROAD.x1, HARBOR.quayX, -1000, 300]
  ];
  for (const [x0, x1, z0, z1] of sidewalks) {
    addSlab(scene, rangeMeshes, x1 - x0, z1 - z0, walk, mats.sidewalk, (x0 + x1) / 2, (z0 + z1) / 2, 0);
  }
  // Raised pavement of the blocks west and east of the plaza.
  addSlab(scene, rangeMeshes, 337, 78, walk, mats.sidewalk, -63 - 168.5, -65, 0);
  addSlab(scene, rangeMeshes, east - 63, 78, walk, mats.sidewalk, (63 + east) / 2, -65, 0);

  // Lane markings and crossings.
  for (const z of [-14, -115]) dashes(scene, mats.paint, z, -400, east - 4);
  for (const [x, z0, z1] of [[-30, -22, -6], [30, -22, -6], [0, -122, -108]]) crossing(scene, mats.paint, x, z0, z1);

  // ---------- buildings ----------
  const decor = createDecor(r);
  for (const [i, [x, z, w, d, h, style]] of TOWERS.entries()) {
    if (TOWER_MODELS[i] && modelBuilding(TOWER_MODELS[i], x, z, w, d, i === 6 ? MERIDIAN_FRONT_Z : null)) continue;
    const facade = facadeMaterial(style);
    const mesh = new THREE.Mesh(buildingGeometry(w, h, d), [facade, facade, mats.roof, mats.roof, facade, facade]);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    rangeMeshes.push(mesh);
    cullables.push(mesh);
    colliders.push([x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2]);
    // Our own roof gets hand-placed props instead; the tallest towers stay clean.
    const isOurs = x === 0 && z === 12;
    if (h < 140 && !isOurs) decor.roof(x, z, w, d, h, { antenna: h > 80 });
  }
  let tint = 0;
  for (const [i, [x, z, w, d, h, wall, shopFaces]] of BLOCKS.entries()) {
    if (BLOCK_MODELS[i] && modelBuilding(BLOCK_MODELS[i], x, z, w, d, null)) {
      replacedBlocks.add(i);
      continue;
    }
    let mat = walls[wall];
    if (wall === 'plaster') {
      mat = mat.clone();
      /** @type {THREE.MeshStandardMaterial} */ (mat).color.set(PLASTER_TINTS[tint++ % PLASTER_TINTS.length]);
    }
    const mesh = new THREE.Mesh(wallGeometry(w, h, d, wallTile[wall]), [mat, mat, mats.roof, mats.roof, mat, mat]);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    rangeMeshes.push(mesh);
    cullables.push(mesh);
    colliders.push([x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2]);
    // A cornice at the roof line.
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), mats.curb);
    cornice.position.set(x, h - 0.25, z);
    cornice.castShadow = true;
    scene.add(cornice);
    cullables.push(cornice);
    decor.block({ x, z, w, d, h, shopFaces });
  }
  // Billboards on low roofs, turned toward the player's rooftop.
  // (The last number is the BLOCKS index the billboard stands on; replaced blocks get none.)
  for (const [x, z, h, block] of [[74, -70, 20, 3], [-42, -155, 28, 7], [58, -158, 26, 8], [-78, -52, 22, 1], [108, -92, 18, 6]]) {
    if (replacedBlocks.has(block)) continue;
    decor.billboard(x, h + 0.9, z, Math.atan2(LAYOUT.eye.x - x, LAYOUT.eye.z - z));
  }

  // Meridian Tower entrance canopy and doors.
  addBox(scene, mats.metal, [LAYOUT.meridianDoor.x, 4.2, -126.6], [10, 0.3, 3], colliders, rangeMeshes, false);
  addBox(scene, new THREE.MeshStandardMaterial({ color: '#1b2229', roughness: 0.15, metalness: 0.8 }),
    [LAYOUT.meridianDoor.x, 1.6, -127.05], [4, 3.2, 0.1], null, null, false);

  // Our roof: parapet in front of the player and on the sides.
  const ry = LAYOUT.roofY;
  const parapet = new THREE.MeshStandardMaterial({ color: '#7e7a74', roughness: 0.95 });
  addBox(scene, parapet, [0, ry + 0.42, -1.8], [30, 0.84, 0.4], colliders, null, true);
  addBox(scene, parapet, [-14.8, ry + 0.42, 12], [0.4, 0.84, 28], colliders, null, true);
  addBox(scene, parapet, [14.8, ry + 0.42, 12], [0.4, 0.84, 28], colliders, null, true);

  // ---------- harbour and skyline ----------
  const harbor = buildHarbor(scene, { concrete: mats.roof }, colliders, rangeMeshes, slab, containerPack);
  skyline(scene, r);

  // ---------- plaza furniture ----------
  const f = LAYOUT.fountain;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(f.r, f.r + 0.3, 0.7, 48), mats.stone);
  basin.position.set(f.x, walk + 0.35, f.z);
  basin.castShadow = basin.receiveShadow = true;
  scene.add(basin);
  colliders.push([f.x - f.r, 0, f.z - f.r, f.x + f.r, walk + 0.7, f.z + f.r]);
  const water = new THREE.Mesh(new THREE.CircleGeometry(f.r - 0.45, 48), mats.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(f.x, walk + 0.71, f.z);
  scene.add(water);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 2.6, 24), mats.stone);
  column.position.set(f.x, walk + 1.5, f.z);
  column.castShadow = true;
  scene.add(column);

  const lampSpots = [];
  for (let x = -40; x <= 40; x += 20) lampSpots.push({ x, z: -24.5 }, { x, z: -105.5 });
  const lampPart = props1 && props1.parts.get('Light');
  if (lampPart) instancePart(scene, lampPart, lampSpots.map((p) => ({ ...p, y: walk, s: 1.25 })));
  else for (const p of lampSpots) lamp(scene, mats.metal, p.x, p.z);

  // ---------- models: Poly Haven props, trees, traffic lights, cars ----------
  const [aircon, airduct, utility, barrier, hydrant, seating, covered, treeGltf, lightGltf, carGltf] = await Promise.all([
    ...['aircon', 'airduct', 'utility_box', 'barrier', 'hydrant', 'seating', 'covered_car'].map((n) => loadProp(manifest, n)),
    ...['tree', 'traffic_light', 'sedan_wagon'].map((n) => loadGLTF('./models/props/' + n + '.glb').catch((err) => {
      console.warn('Model ' + n + ' did not load.', err);
      return null;
    }))
  ]);

  const benches = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const bx = f.x + Math.cos(a) * 11;
    const bz = f.z + Math.sin(a) * 11;
    benches.push({ x: bx, z: bz, face: Math.atan2(f.x - bx, f.z - bz) });
    if (props1 && props1.parts.get('ParkBenchLong')) continue;
    if (seating) placeProp(scene, seating, bx, walk, bz, Math.atan2(f.x - bx, f.z - bz) + Math.PI / 2, 2.2);
    else addBox(scene, mats.trunk, [bx, walk + 0.25, bz], [1.8, 0.5, 0.6], null, null, true);
  }
  // Realistic street furniture from the Sketchfab props packs, one instanced set per kind.
  const prop = (pack, name) => pack && pack.parts.get(name);
  instancePart(scene, prop(props1, 'ParkBenchLong'), benches.map((b) => ({ x: b.x, z: b.z, y: walk, rot: b.face + Math.PI / 2 })));
  instancePart(scene, prop(props1, 'TrashCanLarge'), [[-36, -22.8], [14, -22.8], [52, -22.8], [-14, -104.7], [36, -104.7], [-52, -104.7]].map(([x, z]) => ({ x, z, y: walk })));
  instancePart(scene, prop(props1, 'ParkingMeter'), [70, 78, 86, 94, -70, -78, -86].map((x) => ({ x, z: -22.6, y: walk, rot: Math.PI })));
  instancePart(scene, prop(props1, 'PostBox'), [{ x: -44, z: -105.6, y: walk }, { x: 60, z: -24.4, y: walk, rot: Math.PI }]);
  instancePart(scene, prop(props2, 'planter_pot'), [[-42, -29], [42, -29], [-42, -101], [42, -101], [-20, -101], [20, -101]].map(([x, z]) => ({ x, z, y: walk })));
  instancePart(scene, prop(props2, 'clock'), [{ x: -20, z: -29.5, y: walk }]);
  instancePart(scene, prop(props2, 'information'), [{ x: 20, z: -29.5, y: walk, rot: Math.PI }]);
  for (const x of [-32, -20, 20, 32]) placeProp(scene, barrier, x, walk, -103.2, 0, 2.2);
  placeProp(scene, hydrant, -43, walk, -24.5, 0, 0.45);
  placeProp(scene, hydrant, 43, walk, -106, 0, 0.45);
  placeProp(scene, utility, 44, walk, -40, -Math.PI / 2, 1.0);
  placeProp(scene, covered, -60, 0, -8.5, Math.PI / 2, 0);
  // Our rooftop: units behind and beside the firing position.
  placeProp(scene, aircon, -9, ry, 6, 0, 1.6);
  placeProp(scene, aircon, -6.5, ry, 6, 0, 1.6);
  placeProp(scene, airduct, 7, ry, 9, Math.PI / 2, 4);
  placeProp(scene, utility, 12.5, ry, 2, -Math.PI / 2, 1.0);

  // Rooftop AC units everywhere else, instanced from the same Poly Haven model.
  let acSet = null;
  if (aircon && decor.acCount) {
    const baked = bakeByMaterial(aircon);
    normalise(baked, { length: 1.6 });
    acSet = instanced(baked, decor.acCount);
  }
  decor.build(scene, { curb: mats.curb, metal: mats.metal }, acSet);

  // Trees: plaza planters, street trees and the promenade.
  const treeSpots = [];
  for (const x of [-38, 38]) for (const z of [-34, -52, -72, -92]) treeSpots.push({ x, z, planter: true });
  for (let x = -110; x <= 110; x += 22) if (Math.abs(x) > 50) treeSpots.push({ x, z: -24.2, planter: false });
  for (let z = 40; z >= -320; z -= 16) treeSpots.push({ x: QUAY_ROAD.x1 + 4, z, planter: false });
  for (const s of treeSpots) {
    if (!s.planter) continue;
    const planter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 2.4), mats.curb);
    planter.position.set(s.x, walk + 0.3, s.z);
    planter.castShadow = planter.receiveShadow = true;
    scene.add(planter);
  }
  if (!plantTrees(scene, treeGltf, treeSpots, r)) {
    for (const s of treeSpots) blobTree(scene, mats, s.x, s.z, r);
  }

  // Traffic lights at the three crossings, arms reaching over the road.
  placeTrafficLights(scene, lightGltf, [
    { x: -33.5, z: -24.6, rot: 0 }, { x: 33.5, z: -3.4, rot: Math.PI },
    { x: 26.5, z: -24.6, rot: 0 }, { x: -26.5, z: -3.4, rot: Math.PI },
    { x: 3.5, z: -105.4, rot: Math.PI }, { x: -3.5, z: -124.6, rot: 0 }
  ]);

  // ---------- traffic ----------
  const traffic = makeTraffic(scene, carGltf, r);

  return {
    colliders,
    rangeMeshes,
    cullables,
    benches,
    /** Box colliders of the moving cars, refreshed every frame. */
    carColliders: traffic.colliders,
    targetCar: traffic.targetCar,
    /** @param {number} dt */
    update(dt) {
      traffic.update(dt);
      harbor.update(dt);
    }
  };
}

// ---------- helpers ----------

/** A box whose UVs are world metres divided by the material's tile size. */
function slab(w, d, h, mat, x, z, y) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const tile = (mat.userData && mat.userData.metresPerTile) || 4;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + x) / tile, (pos.getZ(i) + z) / tile + pos.getY(i) / tile);
  uv.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

function addSlab(scene, rangeMeshes, w, d, h, mat, x, z, y) {
  const m = slab(w, d, h, mat, x, z, y);
  m.receiveShadow = true;
  scene.add(m);
  rangeMeshes.push(m);
  return m;
}

/**
 * A box building with wall UVs in metres / tile, so photo textures keep their real scale.
 * Groups 0-1 and 4-5 are walls, 2 the roof, 3 the underside.
 */
function wallGeometry(w, h, d, tile) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + w / 2;
    const y = pos.getY(i) + h / 2;
    const z = pos.getZ(i) + d / 2;
    if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, x / 4, z / 4);
    else if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, z / tile, y / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  uv.needsUpdate = true;
  return geo;
}

function addBox(scene, mat, pos, size, colliders, rangeMeshes, shadow) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.castShadow = !!shadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (colliders) {
    colliders.push([pos[0] - size[0] / 2, pos[1] - size[1] / 2, pos[2] - size[2] / 2,
      pos[0] + size[0] / 2, pos[1] + size[1] / 2, pos[2] + size[2] / 2]);
  }
  if (rangeMeshes) rangeMeshes.push(mesh);
  return mesh;
}

function dashes(scene, mat, z, x0, x1) {
  const geo = new THREE.BoxGeometry(3, 0.02, 0.15);
  const count = Math.floor((x1 - x0) / 5);
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(x0 + i * 5, 0.01, z);
    inst.setMatrixAt(i, m);
  }
  inst.receiveShadow = true;
  scene.add(inst);
}

function crossing(scene, mat, x, z0, z1) {
  const n = Math.floor((z1 - z0) / 1.2);
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 0.02, 0.6), mat, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    m.makeTranslation(x, 0.01, z0 + 0.6 + i * 1.2);
    inst.setMatrixAt(i, m);
  }
  inst.receiveShadow = true;
  scene.add(inst);
}

/** Simple tree from blobs, used when the tree model is missing. */
function blobTree(scene, mats, x, z, r) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.2, 8), mats.trunk);
  trunk.position.set(x, LAYOUT.walkY + 2.1, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const leaves = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.25 + r() * 0.05, 0.42, 0.13 + r() * 0.05), roughness: 1 });
  for (let i = 0; i < 11; i++) {
    const s = 0.8 + r() * 0.7;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), leaves);
    blob.position.set(x + (r() - 0.5) * 2.2, LAYOUT.walkY + 4 + r() * 1.8, z + (r() - 0.5) * 2.2);
    blob.castShadow = true;
    scene.add(blob);
  }
}

/**
 * Trees from the CC-BY tree model (two variants in one file), instanced. Returns false when
 * the model is missing so the caller can fall back.
 */
function plantTrees(scene, gltf, spots, r) {
  if (!gltf) return false;
  /** @type {THREE.Mesh[]} */
  const variants = [];
  gltf.scene.traverse((o) => {
    if (/** @type {any} */ (o).isMesh) variants.push(/** @type {THREE.Mesh} */ (o));
  });
  if (!variants.length) return false;
  const sets = variants.map((v) => {
    const baked = bakeByMaterial(gltf.scene, (mesh) => mesh === v);
    for (const mat of baked.keys()) {
      const sm = /** @type {THREE.MeshStandardMaterial} */ (mat);
      if (sm.isMeshStandardMaterial) {
        sm.metalness = 0;
        sm.roughness = 0.9;
      }
    }
    normalise(baked, { height: 1 });
    return { set: instanced(baked, spots.length), used: 0 };
  });
  spots.forEach((s, i) => {
    const v = sets[i % sets.length];
    const h = 6.5 + r() * 3;
    v.set.set(v.used++, place(s.x, LAYOUT.walkY + (s.planter ? 0.6 : 0), s.z, r() * Math.PI * 2, h));
  });
  for (const v of sets) {
    for (const m of v.set.meshes) m.count = v.used;
    v.set.finish();
    scene.add(v.set.group);
  }
  return true;
}

/** The CC-BY traffic light assembly, instanced at each spot with its arm toward local +z. */
function placeTrafficLights(scene, gltf, spots) {
  if (!gltf) return;
  const baked = bakeByMaterial(gltf.scene);
  // Put the pole's foot at the origin: the model's pole stands near the low-z end of its box.
  const box = new THREE.Box3();
  for (const g of baked.values()) {
    g.computeBoundingBox();
    box.union(g.boundingBox);
  }
  const shift = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + 0.27));
  for (const [mat, g] of baked) {
    g.applyMatrix4(shift);
    const sm = /** @type {THREE.MeshStandardMaterial} */ (mat);
    if (sm.isMeshStandardMaterial) sm.metalness = Math.min(sm.metalness, 0.4);
  }
  const set = instanced(baked, spots.length);
  spots.forEach((s, i) => set.set(i, place(s.x, LAYOUT.walkY, s.z, s.rot, 1)));
  set.finish();
  scene.add(set.group);
}

function lamp(scene, mat, x, z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6, 8), mat);
  pole.position.set(x, LAYOUT.walkY + 3, z);
  pole.castShadow = true;
  scene.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.35), mat);
  head.position.set(x, LAYOUT.walkY + 6, z);
  scene.add(head);
}

/**
 * Distant towers as instanced boxes, one batch per facade style: downtown to the west and
 * north, and a far shore across the harbour to the east. Nothing is placed on the water.
 */
function skyline(scene, r) {
  const styles = Object.keys(STYLES);
  const per = 70;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  // Instances share UVs, so tile the unit box as an average distant tower (4 x 9 facade tiles).
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 9);
  for (const style of styles) {
    const inst = new THREE.InstancedMesh(geo, facadeMaterial(style), per);
    let n = 0;
    let guard = 0;
    while (n < per && guard++ < 5000) {
      let x;
      let z;
      let h;
      if (n % 3 === 2) {
        // Far shore across the water.
        x = HARBOR.farShoreX + 40 + r() * 600;
        z = -1300 + r() * 1300;
        h = 25 + Math.pow(r(), 2) * 140;
      } else {
        const a = r() * Math.PI * 2;
        const dist = 320 + r() * 750;
        x = Math.sin(a) * dist;
        z = Math.cos(a) * dist - 80;
        h = 30 + Math.pow(r(), 2) * 230;
        if (z > 60 && Math.abs(x) < 200) continue; // keep the view behind the player clear
        if (x > QUAY_ROAD.x0 - 20) continue; // water and pier
      }
      const w = 30 + r() * 40;
      m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, 30 + r() * 40));
      inst.setMatrixAt(n++, m);
    }
    inst.count = n;
    inst.computeBoundingSphere();
    scene.add(inst);
  }
}

// ---------- traffic ----------

const PAINTS = ['#1c1f24', '#e8e6e1', '#8b9097', '#2c3e57', '#7a1e1e', '#3d4a3a', '#c9b48a', '#f0f0f0', '#5a6b7a', '#9a3b1c'];

/**
 * Cars follow looped routes: along the avenue or Meridian Street, then up or down the quay
 * road, and back to the far west end out of sight.
 */
const ROUTES = [
  [{ x: -420, z: -10 }, { x: 131, z: -10 }, { x: 131, z: -460 }],
  [{ x: 137, z: -460 }, { x: 137, z: -18 }, { x: -420, z: -18 }],
  [{ x: -420, z: -113 }, { x: 131, z: -113 }, { x: 131, z: -460 }],
  [{ x: 137, z: -460 }, { x: 137, z: -118.5 }, { x: -420, z: -118.5 }]
];

/**
 * @param {THREE.Scene} scene
 * @param {any} gltf the sedan and wagon model, or null for simple box cars
 * @param {() => number} r
 */
function makeTraffic(scene, gltf, r) {
  const perRoute = 5;
  const cars = [];
  const colliders = [];
  const routes = ROUTES.map((pts) => {
    let len = 0;
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      segs.push({ a, b, l, start: len });
      len += l;
    }
    return { segs, len };
  });

  // Instanced sedan and wagon from the CC-BY model, or box cars as a fallback.
  /** @type {{ set: ReturnType<typeof instanced>, used: number }[]} */
  let kinds = [];
  /** @type {THREE.Object3D} */
  let targetCar;
  const paintMat = (mat) => /^body(\.\d+)?$/.test(String(mat.name || '').toLowerCase());
  if (gltf) {
    const remap = (mat) => {
      const name = (mat.name || '').toLowerCase();
      if (/^body(\.\d+)?$/.test(name)) return new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.32, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.08 });
      if (name.includes('window')) return new THREE.MeshStandardMaterial({ color: '#10161c', roughness: 0.05, metalness: 0.85 });
      const m = mat.clone();
      m.metalness = name.includes('rim') ? 0.6 : 0.05;
      m.roughness = name.includes('tire') ? 0.9 : 0.5;
      return m;
    };
    const bakeCar = (rootName) => {
      const baked = bakeByMaterial(gltf.scene, (mesh) => {
        let o = /** @type {THREE.Object3D | null} */ (mesh);
        while (o) {
          if (o.name === rootName) return true;
          o = o.parent;
        }
        return false;
      });
      normalise(baked, { length: 4.4 });
      return baked;
    };
    const sedan = bakeCar('body_sedan');
    const wagon = bakeCar('body_wagon');
    const total = perRoute * ROUTES.length;
    kinds = [sedan, wagon].map((baked) => ({ set: instanced(baked, total, { paint: paintMat, remap, moving: true }), used: 0 }));
    for (const k of kinds) scene.add(k.set.group);
    // The target's black sedan, as plain meshes so game.js can drive it away.
    const g = new THREE.Group();
    for (const [mat, geo] of sedan) {
      const mm = remap(mat);
      if (/** @type {any} */ (mm).isMeshPhysicalMaterial) /** @type {THREE.MeshPhysicalMaterial} */ (mm).color.set('#101215');
      const mesh = new THREE.Mesh(geo, mm);
      mesh.castShadow = true;
      g.add(mesh);
    }
    targetCar = g;
  } else {
    targetCar = makeCar('#121418');
  }

  const color = new THREE.Color();
  routes.forEach((route, ri) => {
    for (let i = 0; i < perRoute; i++) {
      const box = [0, 0, 0, 0, 0, 0];
      colliders.push(box);
      const car = { route, dist: (i / perRoute) * route.len + r() * 40, speed: 9 + r() * 5, box, kind: -1, index: -1, obj: null };
      if (kinds.length) {
        car.kind = (ri + i) % kinds.length;
        car.index = kinds[car.kind].used++;
        kinds[car.kind].set.paint(car.index, color.set(PAINTS[Math.floor(r() * PAINTS.length)]));
      } else {
        car.obj = makeCar(PAINTS[Math.floor(r() * PAINTS.length)]);
        scene.add(car.obj);
      }
      cars.push(car);
    }
  });
  for (const k of kinds) for (const m of k.set.meshes) m.count = k.used;

  targetCar.position.set(LAYOUT.targetCar.x, 0, LAYOUT.targetCar.z);
  targetCar.rotation.y = Math.PI / 2;
  scene.add(targetCar);
  colliders.push([LAYOUT.targetCar.x - 2.4, 0, LAYOUT.targetCar.z - 1, LAYOUT.targetCar.x + 2.4, 1.5, LAYOUT.targetCar.z + 1]);

  const mtx = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const update = (dt) => {
    for (const c of cars) {
      c.dist = (c.dist + c.speed * dt) % c.route.len;
      let seg = c.route.segs[0];
      for (const s of c.route.segs) if (c.dist >= s.start) seg = s;
      const t = (c.dist - seg.start) / seg.l;
      const x = seg.a.x + (seg.b.x - seg.a.x) * t;
      const z = seg.a.z + (seg.b.z - seg.a.z) * t;
      const heading = Math.atan2(seg.b.x - seg.a.x, seg.b.z - seg.a.z);
      if (c.obj) {
        c.obj.position.set(x, 0, z);
        c.obj.rotation.y = heading;
      } else {
        quat.setFromAxisAngle(up, heading);
        kinds[c.kind].set.set(c.index, mtx.compose(pos.set(x, 0, z), quat, one));
      }
      const alongX = Math.abs(seg.b.x - seg.a.x) > Math.abs(seg.b.z - seg.a.z);
      const hx = alongX ? 2.3 : 0.95;
      const hz = alongX ? 0.95 : 2.3;
      c.box[0] = x - hx; c.box[1] = 0; c.box[2] = z - hz;
      c.box[3] = x + hx; c.box[4] = 1.45; c.box[5] = z + hz;
    }
    for (const k of kinds) k.set.finish();
  };
  update(0);

  return { colliders, targetCar, update };
}

/** A simple sedan: painted body, dark glass cabin and four wheels. Faces +z. */
function makeCar(paint) {
  const g = new THREE.Group();
  const body = new THREE.MeshPhysicalMaterial({ color: paint, roughness: 0.35, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: '#141a20', roughness: 0.05, metalness: 0.9 });
  const tyre = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 });
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.62, 4.6), body);
  lower.position.y = 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.56, 2.5), glass);
  cabin.position.set(0, 1.2, -0.2);
  const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 1.9), body);
  roofPanel.position.set(0, 1.5, -0.25);
  for (const m of [lower, cabin, roofPanel]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-0.86, 1.45], [0.86, 1.45], [-0.86, -1.45], [0.86, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, tyre);
    w.position.set(x, 0.34, z);
    g.add(w);
  }
  return g;
}
