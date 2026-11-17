// @ts-check
// Detail for mid-rise "block" buildings and every rooftop: framed windows, shopfronts with
// awnings and signs (invented brands), parapets, stair huts, water tanks, antennas, skylights,
// AC units and a few billboards. Items are collected first and built at the end as a handful
// of instanced or merged meshes, so hundreds of windows cost two draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Invented shop names and their sign colours: [name, background, text]. */
const BRANDS = [
  ['HARBOR & HOOK', '#1f3a52', '#f2e6c9'], ['KOMA COFFEE', '#2b2b2b', '#f0c36d'], ['MARLOWE BOOKS', '#5b2a2a', '#f3ead8'],
  ['NOVA PHARMACY', '#2f6b4f', '#ffffff'], ['PIER 9 DINER', '#b23a2e', '#fff3d6'], ['SALT & CEDAR', '#e8e1d2', '#3a2e24'],
  ['VELA OPTICS', '#13212e', '#7fd0e6'], ['DOCKSIDE DELI', '#d7a43b', '#2a1f12'], ['ORCHID NAILS', '#f0d6e2', '#6a2a4a'],
  ['FERRO HARDWARE', '#3d3f42', '#f2b134'], ['LUMEN STUDIO', '#f4f1ea', '#1d1d1d'], ['BLUE GULL BAR', '#173a5e', '#9fd3ff'],
  ['TIDE BAKERY', '#f3e3c3', '#7a4b1e'], ['ATLAS TRAVEL', '#0f4c5c', '#ffd27a'], ['QUAY FLOWERS', '#5d7a3a', '#fff8e8'],
  ['KESTREL TAILORS', '#20242a', '#d8c08a']
];

/** Invented billboard ads: [headline, line, background, accent]. */
const ADS = [
  ['VELA AIR', 'Fly the whole coast tonight', '#0f4c6e', '#ffcf6b'],
  ['KOMA COFFEE', 'Roasted at the port since 1962', '#2a1d16', '#f0c36d'],
  ['NORTHMARK BANK', 'Your harbour. Your future.', '#1c2a3a', '#7fd0e6'],
  ['SPRINT 9', 'Run the city', '#b23a2e', '#ffffff'],
  ['HARBORVIEW AQUARIUM', 'Sharks at eye level', '#0d5f6b', '#ffe08a']
];

const AWNING_COLORS = ['#7a2e2e', '#2f4f6f', '#3d5a3a', '#c8a24a', '#5b3a5e', '#d06b3a', '#2b2b2b', '#8a6a4a'];
const FRAME_COLORS = ['#ece6da', '#e9e5df', '#2b2d30', '#d8cdb8'];

const FLOOR_H = 3.4;
const WALK = 0.15;

/** @param {() => number} r seeded random */
export function createDecor(r) {
  /** @type {{ x: number, y: number, z: number, rot: number, frame: string, lit: boolean, tint: string }[]} */
  const windows = [];
  /** @type {{ x: number, y: number, z: number, rot: number, w: number, lit: boolean }[]} */
  const shops = [];
  /** @type {{ x: number, y: number, z: number, rot: number, w: number, color: string }[]} */
  const awnings = [];
  /** @type {{ x: number, y: number, z: number, rot: number, w: number, h: number, cell: number }[]} */
  const signs = [];
  /** @type {{ x: number, y: number, z: number, w: number, h: number, d: number, metal: boolean }[]} */
  const boxes = [];
  /** @type {{ x: number, y: number, z: number }[]} */
  const tanks = [];
  /** @type {{ x: number, y: number, z: number, h: number }[]} */
  const antennas = [];
  /** @type {{ x: number, y: number, z: number, w: number, d: number }[]} */
  const skylights = [];
  /** @type {{ x: number, y: number, z: number, rot: number }[]} */
  const acUnits = [];
  /** @type {{ x: number, y: number, z: number, rot: number, ad: number }[]} */
  const billboards = [];

  /** The four faces of a box building. */
  function faces(x, z, w, d) {
    return {
      n: { cx: x, cz: z - d / 2, nx: 0, nz: -1, tx: 1, tz: 0, len: w },
      s: { cx: x, cz: z + d / 2, nx: 0, nz: 1, tx: -1, tz: 0, len: w },
      e: { cx: x + w / 2, cz: z, nx: 1, nz: 0, tx: 0, tz: -1, len: d },
      w: { cx: x - w / 2, cz: z, nx: -1, nz: 0, tx: 0, tz: 1, len: d }
    };
  }

  return {
    /**
     * A mid-rise block: windows on every face, shopfronts on the faces listed in `shopFaces`
     * (letters n, s, e, w), and rooftop detail.
     * @param {{ x: number, z: number, w: number, d: number, h: number, shopFaces: string }} b
     */
    block(b) {
      const f = faces(b.x, b.z, b.w, b.d);
      const frame = FRAME_COLORS[Math.floor(r() * FRAME_COLORS.length)];
      for (const key of ['n', 's', 'e', 'w']) {
        const face = f[key];
        const rot = Math.atan2(face.nx, face.nz);
        const shop = b.shopFaces.includes(key);
        // Upper floors.
        const cols = Math.max(1, Math.floor((face.len - 2) / 3.2));
        const startY = shop ? 5.4 : 2.0;
        for (let y = startY; y + 1.2 < b.h - 0.8; y += FLOOR_H) {
          for (let c = 0; c < cols; c++) {
            const t = (c - (cols - 1) / 2) * 3.2;
            windows.push({
              x: face.cx + face.tx * t, y, z: face.cz + face.tz * t, rot, frame,
              lit: r() < 0.12, tint: r() < 0.5 ? '#3a4a58' : r() < 0.5 ? '#2c3a46' : '#4a5966'
            });
          }
        }
        if (!shop) continue;
        // Ground-floor shops: glass, awning and a sign per bay.
        const bays = Math.max(1, Math.floor((face.len - 2) / 6.5));
        const bayW = (face.len - 2) / bays;
        for (let i = 0; i < bays; i++) {
          const t = (i - (bays - 1) / 2) * bayW;
          const x = face.cx + face.tx * t;
          const z = face.cz + face.tz * t;
          shops.push({ x, y: WALK + 1.6, z, rot, w: bayW - 1.0, lit: r() < 0.55 });
          if (r() < 0.8) awnings.push({ x, y: 3.6, z, rot, w: bayW - 0.8, color: AWNING_COLORS[Math.floor(r() * AWNING_COLORS.length)] });
          signs.push({ x, y: 4.45, z, rot, w: Math.min(bayW - 1.4, 5), h: 0.9, cell: Math.floor(r() * 64) });
        }
      }
      this.roof(b.x, b.z, b.w, b.d, b.h, { tank: r() < 0.65, skylight: r() < 0.5 });
    },

    /**
     * Parapet and rooftop clutter for any building.
     * @param {{ tank?: boolean, skylight?: boolean, antenna?: boolean }} [opts]
     */
    roof(x, z, w, d, h, opts = {}) {
      const t = 0.4;
      const ph = 0.9;
      boxes.push({ x, y: h + ph / 2, z: z - d / 2 + t / 2, w, h: ph, d: t, metal: false });
      boxes.push({ x, y: h + ph / 2, z: z + d / 2 - t / 2, w, h: ph, d: t, metal: false });
      boxes.push({ x: x - w / 2 + t / 2, y: h + ph / 2, z, w: t, h: ph, d, metal: false });
      boxes.push({ x: x + w / 2 - t / 2, y: h + ph / 2, z, w: t, h: ph, d, metal: false });
      const spot = (margin) => ({ x: x + (r() - 0.5) * Math.max(0, w - margin), z: z + (r() - 0.5) * Math.max(0, d - margin) });
      // Stair hut.
      const s = spot(8);
      boxes.push({ x: s.x, y: h + 1.4, z: s.z, w: 3.2, h: 2.8, d: 4, metal: false });
      // Mechanical boxes and AC units.
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = spot(6);
        acUnits.push({ x: a.x, y: h, z: a.z, rot: Math.floor(r() * 4) * (Math.PI / 2) });
      }
      if (r() < 0.6) {
        const m = spot(8);
        boxes.push({ x: m.x, y: h + 0.9, z: m.z, w: 2 + r() * 3, h: 1.8, d: 2 + r() * 3, metal: true });
      }
      if (opts.tank) {
        const k = spot(10);
        tanks.push({ x: k.x, y: h, z: k.z });
      }
      if (opts.skylight) {
        const k = spot(10);
        skylights.push({ x: k.x, y: h, z: k.z, w: 3 + r() * 3, d: 2 + r() * 2 });
      }
      if (opts.antenna || r() < 0.35) {
        const k = spot(6);
        antennas.push({ x: k.x, y: h, z: k.z, h: 5 + r() * 9 });
      }
    },

    /** A rooftop billboard at (x, h, z) facing angle rot (radians about y). */
    billboard(x, h, z, rot) {
      billboards.push({ x, y: h, z, rot, ad: billboards.length % ADS.length });
    },

    /**
     * Builds everything collected so far.
     * @param {THREE.Scene} scene
     * @param {{ curb: THREE.Material, metal: THREE.Material }} mats
     * @param {{ group: THREE.Group, set: (i: number, m: THREE.Matrix4) => void, finish: () => void } | null} acSet
     *   instanced AC unit model with at least acUnits.length instances, or null for boxes
     */
    build(scene, mats, acSet) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      const color = new THREE.Color();
      const compose = (x, y, z, rot, sx, sy, sz) => {
        q.setFromAxisAngle(up, rot);
        return m.compose(pos.set(x, y, z), q, scl.set(sx, sy, sz));
      };
      const add = (mesh, shadow) => {
        mesh.castShadow = !!shadow;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        scene.add(mesh);
        return mesh;
      };

      // Windows: frames, dark glass and a few lit ones.
      const frameGeo = new THREE.BoxGeometry(1.55, 2.15, 0.1);
      const glassGeo = new THREE.PlaneGeometry(1.25, 1.8);
      const frames = new THREE.InstancedMesh(frameGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), Math.max(1, windows.length));
      const dark = windows.filter((w) => !w.lit);
      const lit = windows.filter((w) => w.lit);
      const glass = new THREE.InstancedMesh(glassGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.08, metalness: 0.8, envMapIntensity: 1.2 }), Math.max(1, dark.length));
      const litGlass = new THREE.InstancedMesh(glassGeo, new THREE.MeshBasicMaterial({ color: '#ffd29a' }), Math.max(1, lit.length));
      const wallOffset = (w, dist) => ({ x: w.x + Math.sin(w.rot) * dist, z: w.z + Math.cos(w.rot) * dist });
      windows.forEach((w, i) => {
        const p = wallOffset(w, 0.04);
        frames.setMatrixAt(i, compose(p.x, w.y, p.z, w.rot, 1, 1, 1));
        frames.setColorAt(i, color.set(w.frame));
      });
      dark.forEach((w, i) => {
        const p = wallOffset(w, 0.096);
        glass.setMatrixAt(i, compose(p.x, w.y, p.z, w.rot, 1, 1, 1));
        glass.setColorAt(i, color.set(w.tint));
      });
      lit.forEach((w, i) => {
        const p = wallOffset(w, 0.096);
        litGlass.setMatrixAt(i, compose(p.x, w.y, p.z, w.rot, 1, 1, 1));
      });
      frames.count = windows.length;
      glass.count = dark.length;
      litGlass.count = lit.length;
      add(frames, false);
      add(glass, false);
      add(litGlass, false);

      // Shopfront glass bands.
      const shopGlass = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 2.9, 0.2),
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.06, metalness: 0.75, envMapIntensity: 1.1 }), Math.max(1, shops.length));
      shops.forEach((s, i) => {
        const p = wallOffset(s, 0.1);
        shopGlass.setMatrixAt(i, compose(p.x, s.y, p.z, s.rot, s.w, 1, 1));
        shopGlass.setColorAt(i, color.set(s.lit ? '#b8956a' : '#3a4a55'));
      });
      shopGlass.count = shops.length;
      add(shopGlass, false);

      // Awnings: a thin slab sloping down and away from the wall.
      const awningGeo = new THREE.BoxGeometry(1, 0.12, 1.8);
      awningGeo.rotateX(0.28);
      awningGeo.translate(0, 0, 0.9);
      const awningMesh = new THREE.InstancedMesh(awningGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), Math.max(1, awnings.length));
      awnings.forEach((a, i) => {
        awningMesh.setMatrixAt(i, compose(a.x, a.y, a.z, a.rot, a.w, 1, 1));
        awningMesh.setColorAt(i, color.set(a.color));
      });
      awningMesh.count = awnings.length;
      add(awningMesh, true);

      // Signs: one merged mesh over a shared atlas of invented brands.
      if (signs.length) {
        const geos = signs.map((s) => {
          const g = new THREE.PlaneGeometry(s.w, s.h);
          const col = s.cell % 4;
          const row = Math.floor(s.cell / 4);
          const u0 = col / 4;
          const u1 = (col + 1) / 4;
          const v1 = 1 - row / 16;
          const v0 = 1 - (row + 1) / 16;
          const uv = g.attributes.uv;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
          const p = wallOffset(s, 0.07);
          g.applyMatrix4(compose(p.x, s.y, p.z, s.rot, 1, 1, 1));
          return g;
        });
        const merged = mergeGeometries(geos, false);
        if (merged) add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ map: signAtlas(), roughness: 0.55 })), false);
      }

      // Parapets, stair huts and mechanical boxes.
      const plain = boxes.filter((b) => !b.metal);
      const metal = boxes.filter((b) => b.metal);
      const unit = new THREE.BoxGeometry(1, 1, 1);
      const boxSet = (list, mat) => {
        const mesh = new THREE.InstancedMesh(unit, mat, Math.max(1, list.length));
        list.forEach((b, i) => mesh.setMatrixAt(i, compose(b.x, b.y, b.z, 0, b.w, b.h, b.d)));
        mesh.count = list.length;
        return add(mesh, true);
      };
      boxSet(plain, mats.curb);
      boxSet(metal, mats.metal);

      // Water tanks: wooden barrel, conical lid, steel legs.
      if (tanks.length) {
        const wood = new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.9 });
        const lid = new THREE.MeshStandardMaterial({ color: '#3b3632', roughness: 0.8 });
        const body = new THREE.CylinderGeometry(1.8, 1.8, 3.4, 18);
        body.translate(0, 3.9, 0);
        const cone = new THREE.ConeGeometry(2, 1.2, 18);
        cone.translate(0, 6.2, 0);
        const legParts = [];
        for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
          const leg = new THREE.BoxGeometry(0.18, 2.2, 0.18);
          leg.translate(lx, 1.1, lz);
          legParts.push(leg);
        }
        const deck = new THREE.BoxGeometry(3.2, 0.15, 3.2);
        deck.translate(0, 2.2, 0);
        legParts.push(deck);
        const legsGeo = mergeGeometries(legParts, false);
        /** @param {THREE.BufferGeometry} geo @param {THREE.Material} mat */
        const tankPart = (geo, mat) => {
          const mesh = new THREE.InstancedMesh(geo, mat, tanks.length);
          tanks.forEach((t, i) => mesh.setMatrixAt(i, compose(t.x, t.y, t.z, 0, 1, 1, 1)));
          add(mesh, true);
        };
        tankPart(body, wood);
        tankPart(cone, lid);
        tankPart(legsGeo, mats.metal);
      }

      // Antennas.
      if (antennas.length) {
        const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.1, 1, 6).translate(0, 0.5, 0), mats.metal, antennas.length);
        antennas.forEach((a, i) => mesh.setMatrixAt(i, compose(a.x, a.y, a.z, 0, 1, a.h, 1)));
        add(mesh, false);
      }

      // Skylights: a low glass box on a curb.
      if (skylights.length) {
        const geo = new THREE.BoxGeometry(1, 0.8, 1).translate(0, 0.4, 0);
        const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#7f97a6', roughness: 0.1, metalness: 0.7 }), skylights.length);
        skylights.forEach((k, i) => mesh.setMatrixAt(i, compose(k.x, k.y, k.z, 0, k.w, 1, k.d)));
        add(mesh, true);
      }

      // AC units: the Poly Haven model when available, otherwise metal boxes.
      if (acSet) {
        acUnits.forEach((a, i) => acSet.set(i, compose(a.x, a.y, a.z, a.rot, 1, 1, 1)));
        for (const mesh of acSet.group.children) /** @type {THREE.InstancedMesh} */ (mesh).count = acUnits.length;
        acSet.finish();
        scene.add(acSet.group);
      } else if (acUnits.length) {
        const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 1.1, 0.8).translate(0, 0.55, 0), mats.metal, acUnits.length);
        acUnits.forEach((a, i) => mesh.setMatrixAt(i, compose(a.x, a.y, a.z, a.rot, 1, 1, 1)));
        add(mesh, true);
      }

      // Billboards: frame on two legs and a printed ad.
      for (const b of billboards) {
        const g = new THREE.Group();
        const legMat = mats.metal;
        for (const lx of [-3.2, 3.2]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3), legMat);
          leg.position.set(lx, 2, -0.3);
          g.add(leg);
        }
        const back = new THREE.Mesh(new THREE.BoxGeometry(10.4, 4.4, 0.3), legMat);
        back.position.set(0, 6, -0.25);
        back.castShadow = true;
        g.add(back);
        const ad = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), new THREE.MeshStandardMaterial({ map: adTexture(ADS[b.ad]), roughness: 0.6 }));
        ad.position.set(0, 6, -0.08);
        g.add(ad);
        g.position.set(b.x, b.y, b.z);
        g.rotation.y = b.rot;
        scene.add(g);
      }

      return { acUnits: acUnits.length };
    },

    /** How many AC units have been asked for, so the caller can size the instanced model. */
    get acCount() {
      return acUnits.length;
    }
  };
}

/** 4 x 16 atlas of 256 x 64 shop signs. */
function signAtlas() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext('2d');
  for (let i = 0; i < 64; i++) {
    const [name, bg, fg] = BRANDS[i % BRANDS.length];
    const x = (i % 4) * 256;
    const y = Math.floor(i / 4) * 64;
    g.fillStyle = bg;
    g.fillRect(x, y, 256, 64);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 4;
    g.strokeRect(x + 2, y + 2, 252, 60);
    g.fillStyle = fg;
    g.font = `bold ${name.length > 13 ? 26 : 32}px "Arial Narrow", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, x + 128, y + 34, 236);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A simple poster: headline, a line of copy and a coloured band. */
function adTexture([headline, line, bg, accent]) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 205;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 205);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, '#0b0f14');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 205);
  g.fillStyle = accent;
  g.fillRect(0, 168, 512, 12);
  g.font = 'bold 56px "Arial Narrow", Arial, sans-serif';
  g.textBaseline = 'alphabetic';
  g.fillText(headline, 24, 86, 470);
  g.fillStyle = '#ffffff';
  g.font = '28px Arial, sans-serif';
  g.fillText(line, 26, 134, 470);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
