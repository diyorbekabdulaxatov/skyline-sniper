// @ts-check
// The city around Harbor Plaza: streets, the plaza with its fountain, buildings with
// reflective facades, rooftop and street props, a distant skyline and moving traffic.
// Units are metres. Axes: x right (east), y up, z toward the player (south); north is -z.
import * as THREE from 'three';
import { facadeMaterial, buildingGeometry, rng, STYLES } from './facades.js';
import { loadGroundMaterial, loadProp, placeProp } from './assets.js';

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

  const [asphalt, sidewalk, roof, plazaTiles] = await Promise.all([
    loadGroundMaterial(manifest, 'asphalt', 6),
    loadGroundMaterial(manifest, 'sidewalk', 3),
    loadGroundMaterial(manifest, 'roof', 4),
    loadGroundMaterial(manifest, 'plaza', 4)
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

  // ---------- ground ----------
  const ground = slab(4000, 4000, 0.02, mats.asphalt, 0, 0, -0.02);
  ground.receiveShadow = true;
  scene.add(ground);
  rangeMeshes.push(ground);

  const walk = LAYOUT.walkY;
  // Plaza and the sidewalks around the blocks.
  const p = LAYOUT.plaza;
  addSlab(scene, rangeMeshes, p.x1 - p.x0, p.z1 - p.z0, walk, mats.plaza, (p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, 0);
  const sidewalks = [
    // avenue, both sides
    [-400, 400, -6, -2], [-400, -45, -26, -22], [45, 400, -26, -22], [-45, 45, -26, -22],
    // north street, both sides
    [-400, 400, -108, -104], [-400, 400, -126, -122],
    // cross streets
    [41, 45, -104, -26], [59, 63, -104, -26], [-45, -41, -104, -26], [-63, -59, -104, -26]
  ];
  for (const [x0, x1, z0, z1] of sidewalks) {
    addSlab(scene, rangeMeshes, x1 - x0, z1 - z0, walk, mats.sidewalk, (x0 + x1) / 2, (z0 + z1) / 2, 0);
  }
  // Blocks west and east of the plaza are raised pavement around their buildings.
  addSlab(scene, rangeMeshes, 337, 78, walk, mats.sidewalk, -63 - 168.5, -65, 0);
  addSlab(scene, rangeMeshes, 337, 78, walk, mats.sidewalk, 63 + 168.5, -65, 0);

  // Lane markings and crossings.
  for (const z of [-14, -115]) dashes(scene, mats.paint, z);
  for (const [x, z0, z1] of [[-30, -22, -6], [30, -22, -6], [0, -122, -108]]) crossing(scene, mats.paint, x, z0, z1);

  // ---------- buildings ----------
  /** @type {[number, number, number, number, number, string][]} x, z, width, depth, height, style */
  const buildings = [
    // our side of the avenue (the player is on the first one)
    [0, 12, 30, 28, LAYOUT.roofY, 'stone'],
    [-36, 16, 34, 34, 30, 'brick'],
    [37, 16, 34, 34, 56, 'office'],
    [-80, 18, 44, 38, 72, 'glassBlue'],
    [84, 18, 44, 38, 38, 'concrete'],
    // west block
    [-78, -46, 28, 36, 48, 'office'],
    [-78, -88, 28, 30, 86, 'glassGreen'],
    [-118, -64, 36, 70, 60, 'stone'],
    // east block
    [78, -42, 28, 30, 34, 'brick'],
    [80, -86, 32, 34, 112, 'glassBlue'],
    [120, -64, 36, 70, 52, 'concrete'],
    // north side of Meridian Street: Meridian Tower is the target's office
    [10, -152, 42, 50, 158, 'glassBlue'],
    [-42, -148, 34, 42, 76, 'stone'],
    [58, -150, 32, 46, 96, 'office'],
    [-86, -152, 38, 50, 124, 'glassGreen'],
    [102, -150, 34, 46, 64, 'brick'],
    // second row
    [-20, -230, 46, 48, 182, 'glassGreen'],
    [44, -236, 40, 44, 132, 'concrete'],
    [-90, -232, 44, 44, 98, 'office'],
    [110, -228, 46, 44, 146, 'glassBlue']
  ];
  const roofMat = mats.roof;
  for (const [x, z, w, d, h, style] of buildings) {
    const facade = facadeMaterial(style);
    const mesh = new THREE.Mesh(buildingGeometry(w, h, d), [facade, facade, roofMat, roofMat, facade, facade]);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    rangeMeshes.push(mesh);
    colliders.push([x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2]);
    // Rooftop clutter and a parapet make the skyline read as real buildings.
    // Our own roof gets hand-placed props instead.
    const isOurs = x === 0 && z === 12;
    if (h < 140 && !isOurs) rooftop(scene, mats, x, z, w, d, h, r);
  }
  // Meridian Tower entrance canopy.
  addBox(scene, mats.metal, [LAYOUT.meridianDoor.x, 4.2, -126.6], [10, 0.3, 3], colliders, rangeMeshes, false);
  addBox(scene, new THREE.MeshStandardMaterial({ color: '#1b2229', roughness: 0.15, metalness: 0.8 }),
    [LAYOUT.meridianDoor.x, 1.6, -127.05], [4, 3.2, 0.1], null, null, false);

  // Our roof: parapet in front of the player and on the sides.
  const ry = LAYOUT.roofY;
  addBox(scene, mats.stone, [0, ry + 0.5, -1.8], [30, 1.0, 0.4], colliders, null, true);
  addBox(scene, mats.stone, [-14.8, ry + 0.5, 12], [0.4, 1.0, 28], colliders, null, true);
  addBox(scene, mats.stone, [14.8, ry + 0.5, 12], [0.4, 1.0, 28], colliders, null, true);

  // ---------- distant skyline ----------
  skyline(scene, r);

  // ---------- plaza furniture ----------
  const f = LAYOUT.fountain;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(f.r, f.r + 0.3, 0.7, 48), mats.stone);
  basin.position.set(f.x, walk + 0.35, f.z);
  basin.castShadow = basin.receiveShadow = true;
  scene.add(basin);
  colliders.push([f.x - f.r, 0, f.z - f.r, f.x + f.r, walk + 0.7, f.z + f.r]);
  const water = new THREE.Mesh(new THREE.CircleGeometry(f.r - 0.35, 48), mats.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(f.x, walk + 0.62, f.z);
  scene.add(water);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 2.6, 24), mats.stone);
  column.position.set(f.x, walk + 1.5, f.z);
  column.castShadow = true;
  scene.add(column);

  const trees = [];
  for (const x of [-38, 38]) for (const z of [-34, -52, -72, -92]) trees.push([x, z]);
  for (const [x, z] of trees) tree(scene, mats, x, z, r);

  for (let x = -40; x <= 40; x += 20) {
    lamp(scene, mats.metal, x, -24.5);
    lamp(scene, mats.metal, x, -105.5);
  }

  // Poly Haven props, if they were fetched.
  const [aircon, airduct, utility, barrier, hydrant, seating, covered] = await Promise.all(
    ['aircon', 'airduct', 'utility_box', 'barrier', 'hydrant', 'seating', 'covered_car'].map((n) => loadProp(manifest, n))
  );
  const benches = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const bx = f.x + Math.cos(a) * 11;
    const bz = f.z + Math.sin(a) * 11;
    benches.push({ x: bx, z: bz, face: Math.atan2(f.x - bx, f.z - bz) });
    if (seating) placeProp(scene, seating, bx, walk, bz, Math.atan2(f.x - bx, f.z - bz) + Math.PI / 2, 2.2);
    else addBox(scene, mats.trunk, [bx, walk + 0.25, bz], [1.8, 0.5, 0.6], null, null, true);
  }
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

  // ---------- traffic ----------
  const traffic = makeTraffic(scene, r);

  return {
    colliders,
    rangeMeshes,
    benches,
    /** Box colliders of the moving cars, refreshed every frame. */
    carColliders: traffic.colliders,
    targetCar: traffic.targetCar,
    /** @param {number} dt */
    update(dt) {
      traffic.update(dt);
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

function dashes(scene, mat, z) {
  const geo = new THREE.BoxGeometry(3, 0.02, 0.15);
  const count = 160;
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(-400 + i * 5, 0.01, z);
    inst.setMatrixAt(i, m);
  }
  inst.receiveShadow = true;
  scene.add(inst);
}

function crossing(scene, mat, x, z0, z1) {
  const n = Math.floor((z1 - z0) / 1.2);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(4, 0.02, 0.6), mat);
    s.position.set(x, 0.01, z0 + 0.6 + i * 1.2);
    s.receiveShadow = true;
    scene.add(s);
  }
}

function rooftop(scene, mats, x, z, w, d, h, r) {
  const parapet = 0.9;
  for (const [px, pz, sw, sd] of [[x, z - d / 2 + 0.2, w, 0.4], [x, z + d / 2 - 0.2, w, 0.4], [x - w / 2 + 0.2, z, 0.4, d], [x + w / 2 - 0.2, z, 0.4, d]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sw, parapet, sd), mats.curb);
    m.position.set(px, h + parapet / 2, pz);
    m.castShadow = true;
    scene.add(m);
  }
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const bw = 2 + r() * 5;
    const bd = 2 + r() * 5;
    const bh = 1.5 + r() * 3;
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), r() < 0.5 ? mats.curb : mats.metal);
    m.position.set(x + (r() - 0.5) * (w - bw - 2), h + bh / 2, z + (r() - 0.5) * (d - bd - 2));
    m.castShadow = true;
    scene.add(m);
  }
}

function tree(scene, mats, x, z, r) {
  const planter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 2.4), mats.curb);
  planter.position.set(x, LAYOUT.walkY + 0.3, z);
  planter.castShadow = planter.receiveShadow = true;
  scene.add(planter);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.2, 8), mats.trunk);
  trunk.position.set(x, LAYOUT.walkY + 2.1, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const leaves = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.26 + r() * 0.04, 0.38, 0.24 + r() * 0.06), roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const s = 1.1 + r() * 0.8;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), leaves);
    blob.position.set(x + (r() - 0.5) * 2.2, LAYOUT.walkY + 4 + r() * 1.8, z + (r() - 0.5) * 2.2);
    blob.castShadow = true;
    scene.add(blob);
  }
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

/** Hundreds of distant towers as instanced boxes, one batch per facade style. */
function skyline(scene, r) {
  const styles = Object.keys(STYLES);
  const per = 60;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  // Instances share UVs, so tile the unit box as an average distant tower (4 x 9 facade tiles).
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 9);
  for (const style of styles) {
    const inst = new THREE.InstancedMesh(geo, facadeMaterial(style), per);
    let n = 0;
    while (n < per) {
      const a = r() * Math.PI * 2;
      const dist = 320 + r() * 700;
      const x = Math.sin(a) * dist;
      const z = Math.cos(a) * dist - 80;
      if (z > 60 && Math.abs(x) < 200) continue; // keep the view behind the player clear
      const w = 30 + r() * 40;
      const h = 30 + Math.pow(r(), 2) * 220;
      m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, 30 + r() * 40));
      inst.setMatrixAt(n++, m);
    }
    scene.add(inst);
  }
}

/** Cars driving along the avenue and Meridian Street, plus the target's parked sedan. */
function makeTraffic(scene, r) {
  const paints = ['#1c1f24', '#e8e6e1', '#8b9097', '#2c3e57', '#7a1e1e', '#3d4a3a', '#c9b48a', '#f0f0f0'];
  const lanes = [
    { z: -10, dir: 1 }, { z: -18, dir: -1 },
    { z: -113, dir: 1 }, { z: -118.5, dir: -1 }
  ];
  const cars = [];
  const colliders = [];
  for (const lane of lanes) {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const car = makeCar(paints[Math.floor(r() * paints.length)]);
      car.position.set(-400 + (i / count) * 800 + r() * 60, 0, lane.z);
      car.rotation.y = lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(car);
      const box = [0, 0, 0, 0, 0, 0];
      colliders.push(box);
      cars.push({ car, lane, speed: 9 + r() * 5, box });
    }
  }
  const targetCar = makeCar('#121418');
  targetCar.position.set(LAYOUT.targetCar.x, 0, LAYOUT.targetCar.z);
  targetCar.rotation.y = Math.PI / 2;
  scene.add(targetCar);
  colliders.push([LAYOUT.targetCar.x - 2.4, 0, LAYOUT.targetCar.z - 1, LAYOUT.targetCar.x + 2.4, 1.5, LAYOUT.targetCar.z + 1]);

  return {
    colliders,
    targetCar,
    /** @param {number} dt */
    update(dt) {
      for (const c of cars) {
        c.car.position.x += c.lane.dir * c.speed * dt;
        if (c.car.position.x > 420) c.car.position.x = -420;
        if (c.car.position.x < -420) c.car.position.x = 420;
        const x = c.car.position.x;
        const z = c.lane.z;
        c.box[0] = x - 2.3; c.box[1] = 0; c.box[2] = z - 0.95;
        c.box[3] = x + 2.3; c.box[4] = 1.45; c.box[5] = z + 0.95;
      }
    }
  };
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
