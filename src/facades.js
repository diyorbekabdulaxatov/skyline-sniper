// @ts-check
// Procedural building facades. Each style draws a colour map and an ARM map (R = ambient
// occlusion, G = roughness, B = metalness) on canvases, so glass reflects the sky and walls
// stay matte. One texture tile covers FACADE_TILE.w x FACADE_TILE.h metres of wall.
import * as THREE from 'three';

export const FACADE_TILE = { w: 12, h: 14.4 };

/** Small seeded random generator. */
export function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 512;
const H = 614; // keeps the 12 x 14.4 m tile at the same pixel density both ways

/**
 * @typedef {{ wall: string, glass: string[], frame: string, kind: 'curtain' | 'bands' | 'punched' }} FacadeStyle
 * @type {Record<string, FacadeStyle>}
 */
export const STYLES = {
  glassBlue: { wall: '#2a3540', glass: ['#3f6176', '#4a6d82', '#355466', '#557a8f'], frame: '#1d252c', kind: 'curtain' },
  glassGreen: { wall: '#2c3a36', glass: ['#3d5f58', '#46685f', '#36544e', '#507468'], frame: '#1e2826', kind: 'curtain' },
  office: { wall: '#cfc8bb', glass: ['#34434f', '#3b4b58', '#2f3d48'], frame: '#8f8a80', kind: 'bands' },
  stone: { wall: '#d9ccb4', glass: ['#3a4651', '#323e48', '#43505b'], frame: '#efe8da', kind: 'punched' },
  brick: { wall: '#8c4f3d', glass: ['#2f3a44', '#38444f', '#2a343c'], frame: '#e6e0d4', kind: 'punched' },
  concrete: { wall: '#a9aaa6', glass: ['#3a4752', '#33404a'], frame: '#7d7f7c', kind: 'bands' }
};

/** @type {Map<string, THREE.MeshStandardMaterial>} */
const cache = new Map();

/**
 * Facade material for a style. Materials are shared, so all buildings of a style batch well.
 * @param {string} style
 */
export function facadeMaterial(style) {
  const hit = cache.get(style);
  if (hit) return hit;
  const s = STYLES[style] || STYLES.office;
  const color = canvas();
  const arm = canvas();
  const g = color.getContext('2d');
  const a = arm.getContext('2d');
  const r = rng(hash(style));
  // Base wall: matte.
  g.fillStyle = s.wall;
  g.fillRect(0, 0, W, H);
  a.fillStyle = rgb(255, 230, 0);
  a.fillRect(0, 0, W, H);
  noise(g, r, 0.05);

  const floors = 4;
  const fh = H / floors;
  if (s.kind === 'curtain') {
    const cols = 6;
    const cw = W / cols;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + 3;
        const y = f * fh + 3;
        pane(g, a, x, y, cw - 6, fh - 6, pick(s.glass, r), r, 0.05);
      }
      // Spandrel line at each floor slab.
      g.fillStyle = s.frame;
      g.fillRect(0, f * fh, W, 6);
      a.fillStyle = rgb(255, 120, 160);
      a.fillRect(0, f * fh, W, 6);
    }
    g.fillStyle = s.frame;
    for (let c = 0; c <= cols; c++) g.fillRect(c * cw - 2, 0, 4, H);
  } else if (s.kind === 'bands') {
    for (let f = 0; f < floors; f++) {
      const y = f * fh + fh * 0.36;
      const h = fh * 0.5;
      pane(g, a, 0, y, W, h, pick(s.glass, r), r, 0.03);
      g.fillStyle = s.frame;
      for (let x = 0; x <= W; x += W / 8) g.fillRect(x - 2, y, 4, h);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(0, y + h, W, 4);
    }
  } else {
    const cols = 4;
    const cw = W / cols;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const w = cw * 0.46;
        const h = fh * 0.56;
        const x = c * cw + (cw - w) / 2;
        const y = f * fh + fh * 0.22;
        g.fillStyle = s.frame;
        g.fillRect(x - 5, y - 5, w + 10, h + 12);
        pane(g, a, x, y, w, h, pick(s.glass, r), r, 0.1);
        g.fillStyle = s.frame;
        g.fillRect(x + w / 2 - 2, y, 4, h);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(x - 5, y + h + 7, w + 10, 3);
      }
    }
  }
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const armTex = new THREE.CanvasTexture(arm);
  for (const t of [map, armTex]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughnessMap: armTex,
    metalnessMap: armTex,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 1.1
  });
  cache.set(style, mat);
  return mat;
}

/** A window pane: colour with a soft vertical sky gradient, glossy and metallic in the ARM map. */
function pane(g, a, x, y, w, h, base, r, blindChance) {
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, shade(base, 18));
  grad.addColorStop(1, shade(base, -14));
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  if (r() < blindChance) {
    // Blinds half down: matte and light.
    const bh = h * (0.3 + r() * 0.5);
    g.fillStyle = 'rgba(176, 172, 162, 0.55)';
    g.fillRect(x, y, w, bh);
    a.fillStyle = rgb(255, 200, 0);
    a.fillRect(x, y, w, bh);
    a.fillStyle = rgb(255, 26, 210);
    a.fillRect(x, y + bh, w, h - bh);
  } else {
    a.fillStyle = rgb(255, 20 + Math.floor(r() * 20), 220);
    a.fillRect(x, y, w, h);
  }
}

function noise(g, r, alpha) {
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
  }
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}

function pick(list, r) {
  return list[Math.floor(r() * list.length)];
}

function rgb(rr, gg, bb) {
  return `rgb(${rr},${gg},${bb})`;
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amount));
  return rgb(c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255));
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A box building whose side UVs are in facade tiles, so windows keep their real size on
 * every building. Groups: 0-1 and 4-5 are walls (facade), 2 is the roof, 3 the underside.
 * @param {number} w @param {number} h @param {number} d
 */
export function buildingGeometry(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + w / 2;
    const y = pos.getY(i) + h / 2;
    const z = pos.getZ(i) + d / 2;
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.setXY(i, x / 10, z / 10);
    else if (nx > 0.5) uv.setXY(i, z / FACADE_TILE.w, y / FACADE_TILE.h);
    else uv.setXY(i, x / FACADE_TILE.w, y / FACADE_TILE.h);
  }
  uv.needsUpdate = true;
  return geo;
}
