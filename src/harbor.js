// @ts-check
// The harbour east of the plaza district: animated water, quay walls, a container pier with
// stacked containers and gantry cranes, a moored container ship and small boats crossing.
// Everything repeated is instanced; the whole harbour costs a few dozen draw calls.
import * as THREE from 'three';
import { rng } from './facades.js';

/** Waterfront geometry shared with city.js. */
export const HARBOR = {
  quayX: 162,
  waterY: -1.6,
  pier: { x0: 162, x1: 330, z0: -330, z1: -150 },
  farShoreX: 950
};

const CONTAINER = { l: 12.2, h: 2.6, w: 2.44 };
const CONTAINER_COLORS = ['#8e3b2b', '#2f5d8a', '#3f6b45', '#d9d4c8', '#7b7f84', '#c4712a', '#6b2f2f', '#1f3f5f', '#b59a3a'];

/**
 * @param {THREE.Scene} scene
 * @param {{ concrete: THREE.Material }} mats
 * @param {number[][]} colliders
 * @param {THREE.Object3D[]} rangeMeshes
 * @param {(w: number, d: number, h: number, mat: THREE.Material, x: number, z: number, y: number) => THREE.Mesh} slab
 *   makes a box with world-metre UVs (from city.js)
 */
export function buildHarbor(scene, mats, colliders, rangeMeshes, slab) {
  const r = rng(404);
  const H = HARBOR;

  // ---------- water ----------
  const waves = waveNormalMap();
  waves.wrapS = waves.wrapT = THREE.RepeatWrapping;
  waves.repeat.set(220, 220);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshStandardMaterial({
      color: '#29404d', roughness: 0.14, metalness: 0.6, normalMap: waves,
      normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 1.25
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(1500, H.waterY, -400);
  water.receiveShadow = true;
  scene.add(water);
  rangeMeshes.push(water);

  // ---------- quay walls and pier ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: '#8a857c', roughness: 0.9 });
  const wallH = 0.2 - H.waterY;
  const quay = (x0, z0, x1, z1) => {
    const w = Math.max(1, Math.abs(x1 - x0));
    const d = Math.max(1, Math.abs(z1 - z0));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    m.position.set((x0 + x1) / 2, H.waterY + wallH / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    scene.add(m);
    rangeMeshes.push(m);
  };
  const p = H.pier;
  quay(H.quayX - 0.5, 600, H.quayX + 0.5, p.z1);
  quay(H.quayX - 0.5, p.z0, H.quayX + 0.5, -1600);
  quay(p.x0, p.z1 - 0.5, p.x1, p.z1 + 0.5);
  quay(p.x1 - 0.5, p.z0, p.x1 + 0.5, p.z1);
  quay(p.x0, p.z0 - 0.5, p.x1, p.z0 + 0.5);
  quay(H.farShoreX - 0.5, 600, H.farShoreX + 0.5, -1600);

  const pierSlab = slab(p.x1 - p.x0, p.z1 - p.z0, 0.4, mats.concrete, (p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, -0.4);
  pierSlab.receiveShadow = true;
  scene.add(pierSlab);
  rangeMeshes.push(pierSlab);
  const farShore = slab(1700, 2400, 0.4, mats.concrete, H.farShoreX + 850, -400, -0.4);
  farShore.receiveShadow = true;
  scene.add(farShore);

  // ---------- containers (pier stacks and ship deck), one instanced mesh ----------
  /** @type {{ x: number, y: number, z: number }[]} */
  const boxes = [];
  for (const gx of [172, 194, 216, 238, 260, 282]) {
    for (let i = 0; i < 6; i++) {
      const x = gx + i * (CONTAINER.w + 0.2);
      for (let z = p.z0 + 14; z < p.z1 - 18; z += CONTAINER.l + 1.4) {
        const stack = r() < 0.12 ? 0 : 1 + Math.floor(r() * 4);
        for (let k = 0; k < stack; k++) boxes.push({ x, y: k * CONTAINER.h, z });
      }
    }
  }
  const ship = { x: p.x1 + 22, z0: p.z0 + 10, z1: p.z1 - 10, beam: 32, deck: 9 };
  for (let i = 0; i < 10; i++) {
    const x = ship.x - ship.beam / 2 + 3 + i * (CONTAINER.w + 0.2);
    for (let z = ship.z0 + 26; z < ship.z1 - 34; z += CONTAINER.l + 0.6) {
      const stack = 2 + Math.floor(r() * 4);
      for (let k = 0; k < stack; k++) boxes.push({ x, y: ship.deck + k * CONTAINER.h, z });
    }
  }
  const containerGeo = new THREE.BoxGeometry(CONTAINER.w, CONTAINER.h, CONTAINER.l);
  containerGeo.translate(0, CONTAINER.h / 2, 0);
  const containers = new THREE.InstancedMesh(
    containerGeo,
    new THREE.MeshStandardMaterial({ map: ribTexture(), roughness: 0.7, metalness: 0.25 }),
    boxes.length
  );
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  boxes.forEach((b, i) => {
    m.makeTranslation(b.x, b.y, b.z);
    containers.setMatrixAt(i, m);
    containers.setColorAt(i, c.set(CONTAINER_COLORS[Math.floor(r() * CONTAINER_COLORS.length)]));
  });
  containers.castShadow = true;
  containers.receiveShadow = true;
  containers.computeBoundingSphere();
  scene.add(containers);
  colliders.push([p.x0 + 6, 0, p.z0 + 10, p.x1 - 40, 11, p.z1 - 14]);

  // ---------- gantry cranes over the pier edge ----------
  const craneMat = new THREE.MeshStandardMaterial({ color: '#b5452c', roughness: 0.6, metalness: 0.3 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#e4e1da', roughness: 0.6 });
  for (const z of [-205, -268]) scene.add(gantryCrane(p.x1, z, craneMat, whiteMat));

  // ---------- the moored ship ----------
  scene.add(containerShip(ship, H.waterY));

  // ---------- small boats crossing the harbour ----------
  const boats = [];
  for (let i = 0; i < 4; i++) {
    const boat = smallBoat(i % 2 === 0 ? '#e9e6df' : '#2c3e57');
    const lane = { z: -420 - i * 140, x0: 380, x1: 900, speed: 4 + r() * 4, dir: i % 2 ? -1 : 1 };
    boat.position.set(lane.x0 + r() * (lane.x1 - lane.x0), H.waterY + 0.2, lane.z);
    boat.rotation.y = lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(boat);
    boats.push({ boat, lane });
  }

  return {
    /** @param {number} dt */
    update(dt) {
      waves.offset.x += dt * 0.004;
      waves.offset.y += dt * 0.0025;
      for (const b of boats) {
        b.boat.position.x += b.lane.dir * b.lane.speed * dt;
        if (b.boat.position.x > b.lane.x1) b.boat.position.x = b.lane.x0;
        if (b.boat.position.x < b.lane.x0) b.boat.position.x = b.lane.x1;
        b.boat.rotation.z = Math.sin(performance.now() * 0.001 + b.lane.z) * 0.02;
      }
    }
  };
}

/** A ship-to-shore gantry crane straddling the quay at (x, z), boom out over the water (+x). */
function gantryCrane(x, z, mat, white) {
  const g = new THREE.Group();
  const add = (w, h, d, px, py, pz, material) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material || mat);
    b.position.set(px, py, pz);
    b.castShadow = true;
    g.add(b);
    return b;
  };
  const gauge = 18;
  const span = 16;
  for (const lx of [-gauge / 2, gauge / 2]) {
    for (const lz of [-span / 2, span / 2]) add(1.4, 40, 1.4, lx, 20, lz);
    add(1.2, 1.2, span, lx, 40, 0);
    add(1.2, 1.2, span, lx, 22, 0);
  }
  for (const lz of [-span / 2, span / 2]) {
    add(gauge, 1.6, 1.4, 0, 40.8, lz);
    add(gauge, 1.0, 1.0, 0, 8, lz);
  }
  // Boom over the water and back-reach over the pier.
  add(110, 2.6, 2.2, 30, 43, -2.6);
  add(110, 2.6, 2.2, 30, 43, 2.6);
  add(4, 1.2, 8, 72, 41.6, 0, white);
  // A-frame and stays.
  for (const lz of [-span / 2 + 2, span / 2 - 2]) {
    const leg = add(1.2, 24, 1.2, -4, 54, lz);
    leg.rotation.z = 0.12;
  }
  add(12, 4, 9, -18, 47, 0, white);
  const stay = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, len, 6), mat);
    s.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    s.rotation.z = Math.atan2(x0 - x1, y1 - y0);
    g.add(s);
  };
  stay(-3, 66, 60, 44);
  stay(-3, 66, 30, 44);
  stay(-3, 66, -24, 44);
  // Both leg rows stand on the pier; the boom reaches out over the water.
  g.position.set(x - 11, 0, z);
  return g;
}

/** A container ship moored along z at x, bow toward -z, bridge near the stern. */
function containerShip(ship, waterY) {
  const g = new THREE.Group();
  const len = ship.z1 - ship.z0;
  const shape = new THREE.Shape();
  const hw = ship.beam / 2;
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, len - 22);
  shape.quadraticCurveTo(hw * 0.4, len, 0, len + 2);
  shape.quadraticCurveTo(-hw * 0.4, len, -hw, len - 22);
  shape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: ship.deck - waterY + 4, bevelEnabled: false });
  // Shape is in x/y; turn it so y runs along -z and the extrusion goes up.
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, ship.deck, 0);
  const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ color: '#1f2b3a', roughness: 0.55, metalness: 0.3 }));
  hull.position.set(ship.x, 0, ship.z1);
  hull.rotation.y = Math.PI;
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);
  const band = new THREE.Mesh(new THREE.BoxGeometry(ship.beam + 0.3, 1.2, len - 30),
    new THREE.MeshStandardMaterial({ color: '#7d2a22', roughness: 0.7 }));
  band.position.set(ship.x, waterY + 0.4, ship.z1 - (len - 30) / 2 - 2);
  g.add(band);
  const white = new THREE.MeshStandardMaterial({ color: '#ece9e2', roughness: 0.5 });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(ship.beam - 4, 18, 14), white);
  bridge.position.set(ship.x, ship.deck + 9, ship.z1 - 16);
  bridge.castShadow = true;
  g.add(bridge);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(ship.beam + 4, 2.4, 6), white);
  wing.position.set(ship.x, ship.deck + 17, ship.z1 - 12);
  g.add(wing);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(ship.beam - 3.8, 1.4, 13.6),
    new THREE.MeshStandardMaterial({ color: '#1a2630', roughness: 0.1, metalness: 0.8 }));
  glass.position.set(ship.x, ship.deck + 16, ship.z1 - 16);
  g.add(glass);
  const funnel = new THREE.Mesh(new THREE.BoxGeometry(5, 9, 6), new THREE.MeshStandardMaterial({ color: '#c94a2f', roughness: 0.6 }));
  funnel.position.set(ship.x, ship.deck + 22, ship.z1 - 6);
  g.add(funnel);
  return g;
}

function smallBoat(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
  hull.position.y = 0.5;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 4), hull.material);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.6);
  bow.position.set(0, 0.5, 6.4);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 3.6), new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.5 }));
  cabin.position.set(0, 2, -1);
  for (const o of [hull, bow, cabin]) {
    o.castShadow = true;
    g.add(o);
  }
  return g;
}

/** Container side ribs: light and dark vertical stripes, tinted by the instance colour. */
function ribTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d');
  for (let x = 0; x < 128; x += 8) {
    g.fillStyle = '#f2f2f2';
    g.fillRect(x, 0, 5, 32);
    g.fillStyle = '#b9b9b9';
    g.fillRect(x + 5, 0, 3, 32);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, 128, 2);
  g.fillRect(0, 30, 128, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A tiling normal map of soft criss-crossing waves. */
function waveNormalMap() {
  const n = 128;
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x / n) * Math.PI * 2;
      const v = (y / n) * Math.PI * 2;
      h[y * n + x] = Math.sin(u * 3 + v) * 0.5 + Math.sin(u * 5 - v * 2) * 0.3 + Math.sin(v * 7 + u * 2) * 0.2 + Math.sin(u * 11 + v * 9) * 0.1;
    }
  }
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = h[y * n + ((x + 1) % n)] - h[y * n + ((x + n - 1) % n)];
      const dy = h[((y + 1) % n) * n + x] - h[((y + n - 1) % n) * n + x];
      const nx = -dx * 2;
      const ny = -dy * 2;
      const l = Math.hypot(nx, ny, 1);
      const i = (y * n + x) * 4;
      img.data[i] = Math.round((nx / l * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}
